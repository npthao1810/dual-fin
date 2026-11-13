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
const CURRENCY = new Set(['đ', 'đồng', 'vnd', '₫', 'd'])
const MARKERS = new Set(['mười', 'mươi', 'trăm', 'chục', 'rưỡi', 'linh', 'lẻ'])

// "65.000", "65,000" (thousands) vs "1,5" / "1.5" (decimal).
function numericValue(token) {
  if (/^\d{1,3}([.,]\d{3})+$/.test(token)) return Number(token.replace(/[.,]/g, ''))
  if (/^\d+([.,]\d+)?$/.test(token)) return Number(token.replace(',', '.'))
  return null
}

// One normalized token -> a list of parts the number machine understands, or
// null when the token is not part of a number. "1tr2" -> [1, tr, 2]; "65k" -> [65, k].
function numberParts(raw) {
  const token = raw.toLowerCase().normalize('NFC')
  const bare = token.replace(/[.,;!?]+$/, '')
  const noCur = bare.replace(/(?<=\d)(đ|d|₫|vnd)$/, '')
  const glued = noCur.match(/^(\d+(?:[.,]\d+)?)(k|tr|m|ty)(\d+)?$/)
  if (glued) {
    const parts = [Number(glued[1].replace(',', '.')), glued[2]]
    if (glued[3]) parts.push(Number(glued[3]))
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
      pendingTrailing = lastUnit > 0
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
  if (!hasUnit && value > 0 && value < 1000) value *= 1000
  return Math.round(value)
}

function findAmount(tokens) {
  let best = null
  let i = 0
  while (i < tokens.length) {
    const parts = numberParts(tokens[i])
    if (!parts) {
      i++
      continue
    }
    let j = i
    const run = []
    while (j < tokens.length) {
      const pp = numberParts(tokens[j])
      if (!pp) break
      run.push(...pp)
      j++
    }
    // A run made only of "đ"/marker words is not an amount.
    const hasValue = run.some((p) => typeof p === 'number' || (p && typeof p === 'object'))
    // A lone digit word ("ba", "nam", "hai") is far more likely a word in the
    // note than an amount, so it only counts alongside a unit or another number.
    const loneWord = run.length === 1 && typeof run[0] === 'object'
    if (hasValue && !loneWord) {
      const value = evaluate(run)
      if (value > 0 && (!best || value > best.value)) best = { start: i, end: j, value }
    }
    i = j
  }
  return best
}

const PAYER = [
  [['em', 'tra'], true], [['em', 'chi'], true], [['em', 'thanh', 'toan'], true],
  [['anh', 'tra'], false], [['anh', 'chi'], false], [['anh', 'thanh', 'toan'], false],
]
const FOR_WHOM = [
  [['cho', 'anh'], 'anh'], [['cua', 'anh'], 'anh'],
  [['cho', 'em'], 'em'], [['cua', 'em'], 'em'],
  [['ca', 'hai'], 'us'], [['hai', 'dua'], 'us'], [['hai', 'vo', 'chong'], 'us'], [['chung'], 'us'],
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

  const amount = findAmount(tokens)
  if (amount) {
    result.amount = amount.value
    for (let k = amount.start; k < amount.end; k++) used.add(k)
  }
  const emChi = extract(norm, PAYER, used)
  if (emChi !== undefined) result.emChi = emChi
  const forWhom = extract(norm, FOR_WHOM, used)
  if (forWhom !== undefined) result.forWhom = forWhom

  const note = tokens.filter((_, i) => !used.has(i)).join(' ').replace(/^[\s,.\-–]+|[\s,.\-–]+$/g, '')
  result.note = note.charAt(0).toUpperCase() + note.slice(1)
  return result
}
