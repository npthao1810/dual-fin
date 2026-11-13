// Lower-case first: "Đ" only folds to "d" once it is "đ".
function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
}

// Turns what a phone keyboard's dictation produces ("cafe slow 65k anh trả",
// "bún mọc tám mươi nghìn em trả") into expense fields. Pure text in, fields
// out: no audio, no network. Fields it cannot find are left undefined so the
// form keeps whatever the user already had.

// Number words only count in their accented spelling: stripped of accents
// "làm" (to do) looks like "lăm" (five), "tắm" like "tám", "muối" like "mười".
// Keyboard dictation always writes the accents.
const DIGITS = {
  'không': 0, 'một': 1, 'mốt': 1, hai: 2, ba: 3, 'bốn': 4, 'tư': 4, 'năm': 5, 'lăm': 5, 'sáu': 6, 'bảy': 7, 'tám': 8, 'chín': 9,
}
const UNITS = { 'nghìn': 1e3, 'ngàn': 1e3, k: 1e3, 'triệu': 1e6, tr: 1e6, m: 1e6, 'tỷ': 1e9, 'tỉ': 1e9 }
const CURRENCY = new Set(['đ', 'đồng', 'vnd', 'vnđ', '₫', 'd'])
// Nothing a person spends comes anywhere near this; it guards against phone
// numbers and runaway input.
const MAX_AMOUNT = 1e11
const MARKERS = new Set(['mười', 'mươi', 'trăm', 'chục', 'rưỡi', 'linh', 'lẻ'])

// "65.000", "65,000" (thousands) vs "1,5" / "1.5" (decimal).
function numericValue(token) {
  if (/^0\d/.test(token)) return null
  if (/^\d{1,3}([.,]\d{3})+$/.test(token)) return Number(token.replace(/[.,]/g, ''))
  if (/^\d+([.,]\d+)?$/.test(token)) return Number(token.replace(',', '.'))
  return null
}

// One normalized token -> a list of parts the number machine understands, or
// null when the token is not part of a number. "1tr2" -> [1, tr, 2]; "65k" -> [65, k].
function numberParts(raw) {
  const token = raw.toLowerCase().normalize('NFC')
  const bare = token.replace(/[.,;!?]+$/, '')
  const noCur = bare.replace(/(?<=\d)(đ|d|₫|vnd|vnđ)$/, '')
  const glued = noCur.match(/^(\d+(?:[.,]\d+)?)(k|tr|m|ty)(\d+)?$/)
  if (glued) {
    const parts = [Number(glued[1].replace(',', '.')), glued[2]]
    // "1tr5", "12k5": the digits glued on are a tenth of the unit.
    if (glued[3]) parts.push({ digit: Number(glued[3]) })
    return parts
  }
  const n = numericValue(noCur)
  if (n !== null) return [n]
  if (Object.hasOwn(DIGITS, noCur)) return [{ digit: DIGITS[noCur] }]
  if (Object.hasOwn(UNITS, noCur) || MARKERS.has(noCur)) return [noCur]
  if (CURRENCY.has(noCur)) return ['cur']
  return null
}

// Evaluate one run of number parts. Returns a VND amount.
function evaluate(parts) {
  let total = 0
  let section = 0
  let cur = 0
  let lastUnit = 0
  let hasUnit = false
  let pendingTrailing = false
  let afterHundred = false
  for (const p of parts) {
    if (p === 'cur' || p === 'linh' || p === 'lẻ') continue
    if (typeof p === 'number' || (p && typeof p === 'object')) {
      const v = typeof p === 'number' ? p : p.digit
      // "20" + "5" (hai mươi lăm) joins; a fresh digit otherwise replaces.
      cur = cur > 0 && cur % 10 === 0 && v < 10 && typeof p === 'object' ? cur + v : v
      // A word or glued digit after a unit is a fraction of it ("một triệu hai").
      // A plain digit token only counts after triệu/tỷ: "65k 2 ly" is not 65,200.
      pendingTrailing = typeof p === 'object' ? lastUnit > 0 : lastUnit >= 1e6
      afterHundred = false
      continue
    }
    if (p === 'mười' || p === 'mươi' || p === 'chục') {
      cur = cur === 0 ? 10 : cur * 10
      afterHundred = false
    } else if (p === 'trăm') {
      section += (cur || 1) * 100
      cur = 0
      afterHundred = true
    } else if (p === 'rưỡi') {
      // "hai trăm rưỡi" = 250, "một triệu rưỡi" = 1.5M
      if (afterHundred) section += 50
      else if (lastUnit) total += lastUnit / 2
    } else if (Object.hasOwn(UNITS, p)) {
      afterHundred = false
      const mult = UNITS[p]
      total += (section + cur) * mult
      section = 0
      cur = 0
      lastUnit = mult
      hasUnit = true
      pendingTrailing = false
    }
  }
  let rest = section + cur
  if (rest > 0 && lastUnit > 0 && pendingTrailing) {
    // "một triệu hai" = 1.2M, "một triệu hai trăm" = 1.2M, "hai nghìn rưỡi" handled above.
    if (section > 0) rest = rest * (lastUnit / 1000)
    else if (cur < 10) rest = cur * (lastUnit / 10)
    else rest = cur * (lastUnit / 100)
  }
  let value = total + rest
  // Said with no unit at all ("hai trăm", "65"): Vietnamese shorthand for thousands.
  const bare = !hasUnit && value > 0 && value < 1000
  if (bare) value *= 1000
  return { value: Math.round(value), bare }
}

// Tokens that may follow a unit-less amount: the payer/recipient words, or
// currency/punctuation. Anything else means the number was part of the note.
function onlyTrailingFiller(tokens, from, used) {
  for (let k = from; k < tokens.length; k++) {
    if (used.has(k)) continue
    const parts = numberParts(tokens[k])
    if (!(parts && parts.length === 1 && parts[0] === 'cur') && /[\p{L}\p{N}]/u.test(tokens[k])) return false
  }
  return true
}

function findAmount(tokens, used) {
  let best = null
  let i = 0
  const partsAt = (k) => (used.has(k) ? null : numberParts(tokens[k]))
  while (i < tokens.length) {
    if (!partsAt(i)) {
      i++
      continue
    }
    let j = i
    const run = []
    while (j < tokens.length) {
      const pp = partsAt(j)
      if (!pp) break
      // "65k 2 ly": a plain number right after k/nghìn starts something new.
      const last = run[run.length - 1]
      if (typeof pp[0] === 'number' && typeof last === 'string' && UNITS[last] < 1e6) break
      run.push(...pp)
      j++
    }
    // "mười" alone has a value; the other markers ("trăm", "rưỡi", "đ") do not.
    const hasValue = run.some((p) => typeof p === 'number' || p === 'mười' || (p && typeof p === 'object'))
    // A lone number word ("ba", "nam", "hai", "mười") is far more likely a word
    // in the note than an amount, so it only counts alongside a unit or a number.
    const loneWord = run.length === 1 && (typeof run[0] === 'object' || run[0] === 'mười')
    if (hasValue && !loneWord) {
      const { value, bare } = evaluate(run)
      // "2 ly cafe": a unit-less small number is only an amount when it ends the text.
      const accepted = !bare || onlyTrailingFiller(tokens, j, used)
      if (accepted && value > 0 && value <= MAX_AMOUNT && (!best || value > best.value)) {
        best = { start: i, end: j, value }
      }
    }
    i = j
  }
  return best
}

const PAYER = [
  [['em', 'tra'], true], [['em', 'chi'], true], [['em', 'thanh', 'toan'], true],
  [['anh', 'tra'], false], [['anh', 'chi'], false], [['anh', 'thanh', 'toan'], false],
  // "trà sữa anh mua": the one who bought it paid for it.
  [['em', 'mua'], true], [['anh', 'mua'], false],
]
const FOR_WHOM = [
  [['cho', 'anh'], 'anh'], [['cua', 'anh'], 'anh'],
  [['cho', 'em'], 'em'], [['cua', 'em'], 'em'],
  [['cho', 'ca', 'hai'], 'us'], [['ca', 'hai'], 'us'], [['cho', 'hai', 'dua'], 'us'], [['hai', 'dua'], 'us'],
  [['cho', 'hai', 'vo', 'chong'], 'us'], [['hai', 'vo', 'chong'], 'us'], [['chung'], 'us'],
]

function matchAt(norm, pattern, i, used) {
  return pattern.every((w, k) => norm[i + k] === w && !used.has(i + k))
}

function extract(norm, table, used) {
  for (let i = 0; i < norm.length; i++) {
    for (const [pattern, value] of table) {
      if (!matchAt(norm, pattern, i, used)) continue
      // "chung cư" is a place, not "shared".
      if (pattern[0] === 'chung' && norm[i + 1] === 'cu') continue
      pattern.forEach((_, k) => used.add(i + k))
      return value
    }
  }
  return undefined
}

/**
 * @param {string} text dictated or typed text
 * @returns {{ amount?: number, note: string, emChi?: boolean, forWhom?: 'us'|'anh'|'em' }}
 */
export function parseSpokenExpense(text) {
  const tokens = (text ?? '').trim().split(/\s+/).filter(Boolean)
  const norm = tokens.map((t) => normalize(t).replace(/[.,;!?]+$/, ''))
  const used = new Set()
  const result = {}

  // Payer / recipient first: "cả hai" and "hai đứa" contain the number word "hai".
  const emChi = extract(norm, PAYER, used)
  if (emChi !== undefined) result.emChi = emChi
  const forWhom = extract(norm, FOR_WHOM, used)
  if (forWhom !== undefined) result.forWhom = forWhom

  const amount = findAmount(tokens, used)
  if (amount) {
    result.amount = amount.value
    for (let k = amount.start; k < amount.end; k++) used.add(k)
  }

  const note = tokens.filter((_, i) => !used.has(i)).join(' ').replace(/^[\s,.\-–]+|[\s,.\-–]+$/g, '')
  result.note = note.charAt(0).toUpperCase() + note.slice(1)
  return result
}
