import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseSpokenExpense as parse } from './parseSpoken.js'

// [input, expected]. Fields left out of `expected` must be absent in the result.
function table(name, rows) {
  describe(name, () => {
    for (const [input, expected] of rows) {
      test(JSON.stringify(input), () => assert.deepEqual(parse(input), expected))
    }
  })
}
const amt = (n, note = '') => ({ amount: n, note })

table('digit formats', [
  ['cafe 65k', amt(65000, 'Cafe')],
  ['cafe 65K', amt(65000, 'Cafe')],
  ['cafe 65 k', amt(65000, 'Cafe')],
  ['cafe 65.000', amt(65000, 'Cafe')],
  ['cafe 65,000', amt(65000, 'Cafe')],
  ['cafe 65000', amt(65000, 'Cafe')],
  ['cafe 65.000đ', amt(65000, 'Cafe')],
  ['cafe 65.000 đ', amt(65000, 'Cafe')],
  ['cafe 65.000₫', amt(65000, 'Cafe')],
  ['cafe 65000 vnd', amt(65000, 'Cafe')],
  ['cafe 65000 VNĐ', amt(65000, 'Cafe')],
  ['cafe 65 nghìn đồng', amt(65000, 'Cafe')],
  ['cafe 65 ngàn', amt(65000, 'Cafe')],
  ['cafe 65.5k', amt(65500, 'Cafe')],
  ['cafe 12k5', amt(12500, 'Cafe')],
  ['lương 1.250.000', amt(1250000, 'Lương')],
  ['lương 1,250,000', amt(1250000, 'Lương')],
  ['nhà 1.5tr', amt(1500000, 'Nhà')],
  ['nhà 1,5tr', amt(1500000, 'Nhà')],
  ['nhà 1.5 triệu', amt(1500000, 'Nhà')],
  ['nhà 1tr5', amt(1500000, 'Nhà')],
  ['nhà 2m5', amt(2500000, 'Nhà')],
  ['nhà 10tr', amt(10000000, 'Nhà')],
  ['nhà 0,5 triệu', amt(500000, 'Nhà')],
  ['vé 1 tỷ', amt(1000000000, 'Vé')],
  ['vé 1,2 tỷ', amt(1200000000, 'Vé')],
  ['cafe 65', amt(65000, 'Cafe')],
  ['cafe 150', amt(150000, 'Cafe')],
])

table('spoken Vietnamese numbers', [
  ['cafe sáu mươi lăm nghìn', amt(65000, 'Cafe')],
  ['cafe mười lăm nghìn', amt(15000, 'Cafe')],
  ['cafe hai mươi nghìn', amt(20000, 'Cafe')],
  ['cafe hai mươi mốt nghìn', amt(21000, 'Cafe')],
  ['cafe hai mươi tư nghìn', amt(24000, 'Cafe')],
  ['cafe bốn mươi lăm nghìn', amt(45000, 'Cafe')],
  ['cafe một trăm nghìn', amt(100000, 'Cafe')],
  ['cafe một trăm linh năm nghìn', amt(105000, 'Cafe')],
  ['cafe một trăm lẻ năm nghìn', amt(105000, 'Cafe')],
  ['cafe hai trăm năm mươi nghìn', amt(250000, 'Cafe')],
  ['cafe chín trăm chín mươi chín nghìn', amt(999000, 'Cafe')],
  ['cafe hai chục nghìn', amt(20000, 'Cafe')],
  ['cafe ba chục', amt(30000, 'Cafe')],
  ['cafe chín chục', amt(90000, 'Cafe')],
  ['cafe mười hai nghìn năm trăm', amt(12500, 'Cafe')],
  ['cafe một nghìn hai', amt(1200, 'Cafe')],
  ['nhà một triệu', amt(1000000, 'Nhà')],
  ['nhà một triệu rưỡi', amt(1500000, 'Nhà')],
  ['nhà hai triệu rưỡi', amt(2500000, 'Nhà')],
  ['nhà một triệu hai', amt(1200000, 'Nhà')],
  ['nhà một triệu hai trăm nghìn', amt(1200000, 'Nhà')],
  ['nhà mười triệu', amt(10000000, 'Nhà')],
  ['nhà hai triệu một trăm nghìn', amt(2100000, 'Nhà')],
  ['nhà một tỷ', amt(1000000000, 'Nhà')],
  ['cafe hai trăm rưỡi nghìn', amt(250000, 'Cafe')],
  ['cafe hai nghìn rưỡi', amt(2500, 'Cafe')],
  ['cafe hai trăm', amt(200000, 'Cafe')],
  ['cafe một trăm rưỡi', amt(150000, 'Cafe')],
  ['SÁU MƯƠI LĂM NGHÌN cafe', amt(65000, 'Cafe')],
])

table('mixed digits and words', [
  ['nhà 2 triệu rưỡi', amt(2500000, 'Nhà')],
  ['nhà 1 triệu 2', amt(1200000, 'Nhà')],
  ['cafe 3 trăm nghìn', amt(300000, 'Cafe')],
  ['cafe 5 chục', amt(50000, 'Cafe')],
  ['cafe một trăm 50 nghìn', amt(150000, 'Cafe')],
  ['cafe 65 nghìn rưỡi', amt(65500, 'Cafe')],
])

table('who paid / for whom', [
  ['cafe 65k anh trả', { amount: 65000, note: 'Cafe', emChi: false }],
  ['cafe 65k anh chi', { amount: 65000, note: 'Cafe', emChi: false }],
  ['cafe 65k anh thanh toán', { amount: 65000, note: 'Cafe', emChi: false }],
  ['cafe 65k em trả', { amount: 65000, note: 'Cafe', emChi: true }],
  ['cafe 65k em chi', { amount: 65000, note: 'Cafe', emChi: true }],
  ['cafe 65k Em Trả', { amount: 65000, note: 'Cafe', emChi: true }],
  ['cafe 65k anh trả.', { amount: 65000, note: 'Cafe', emChi: false }],
  ['anh trả cafe 65k', { amount: 65000, note: 'Cafe', emChi: false }],
  ['cafe 65 anh trả', { amount: 65000, note: 'Cafe', emChi: false }],
  ['quà 500k cho anh', { amount: 500000, note: 'Quà', forWhom: 'anh' }],
  ['quà 500k cho em', { amount: 500000, note: 'Quà', forWhom: 'em' }],
  ['quà 500k của em', { amount: 500000, note: 'Quà', forWhom: 'em' }],
  ['quà 500k cho cả hai', { amount: 500000, note: 'Quà', forWhom: 'us' }],
  ['quà 500k hai đứa', { amount: 500000, note: 'Quà', forWhom: 'us' }],
  ['quà 500k hai vợ chồng', { amount: 500000, note: 'Quà', forWhom: 'us' }],
  ['chợ 700k chung', { amount: 700000, note: 'Chợ', forWhom: 'us' }],
  ['quà 500k em trả cho anh', { amount: 500000, note: 'Quà', emChi: true, forWhom: 'anh' }],
  ['quà 500k anh trả cho em', { amount: 500000, note: 'Quà', emChi: false, forWhom: 'em' }],
  ['quà cho anh 500k em trả', { amount: 500000, note: 'Quà', emChi: true, forWhom: 'anh' }],
  ['trà sữa anh mua cho anh 50000', { amount: 50000, note: 'Trà sữa', emChi: false, forWhom: 'anh' }],
  ['trà sữa em mua cho anh 50000', { amount: 50000, note: 'Trà sữa', emChi: true, forWhom: 'anh' }],
  ['anh mua trà sữa 50k', { amount: 50000, note: 'Trà sữa', emChi: false }],
  ['em mua cho em trà sữa 50k', { amount: 50000, note: 'Trà sữa', emChi: true, forWhom: 'em' }],
  ['mua trà sữa cho anh 50000', { amount: 50000, note: 'Mua trà sữa', forWhom: 'anh' }],
  ['grab anh đi làm 90k', amt(90000, 'Grab anh đi làm')],
  ['cafe em và anh 100k', amt(100000, 'Cafe em và anh')],
  ['đặt cọc chung cư 5 triệu', amt(5000000, 'Đặt cọc chung cư')],
])

table('words that merely look like numbers', [
  ['đi làm bằng grab 45k', amt(45000, 'Đi làm bằng grab')],
  ['làm tóc 300k', amt(300000, 'Làm tóc')],
  ['tắm cho mèo 100k', amt(100000, 'Tắm cho mèo')],
  ['mua muối 15k', amt(15000, 'Mua muối')],
  ['quà cho bà 200k', amt(200000, 'Quà cho bà')],
  ['mua quà cho ba', { note: 'Mua quà cho ba' }],
  ['sau khi ăn', { note: 'Sau khi ăn' }],
  ['năm nay', { note: 'Năm nay' }],
  ['hai người ăn trưa', { note: 'Hai người ăn trưa' }],
  ['bay Đà Nẵng 2 triệu', amt(2000000, 'Bay Đà Nẵng')],
])

table('numbers that are part of the note, not the amount', [
  ['zone 2 coffee 65k', amt(65000, 'Zone 2 coffee')],
  ['2 ly cafe 100k', amt(100000, '2 ly cafe')],
  ['3 người ăn 450k', amt(450000, '3 người ăn')],
  ['tầng 3 gửi xe 20k', amt(20000, 'Tầng 3 gửi xe')],
  ['2 ly cafe', { note: '2 ly cafe' }],
  ['mua 3 cái áo', { note: 'Mua 3 cái áo' }],
  ['cafe 65k 2 ly', amt(65000, 'Cafe 2 ly')],
])

table('dictation quirks', [
  ['Cafe slow 65.000.', amt(65000, 'Cafe slow')],
  ['Cafe slow, 65 nghìn', amt(65000, 'Cafe slow')],
  ['cafe slow 65k , anh trả', { amount: 65000, note: 'Cafe slow', emChi: false }],
  ['  cafe   65k  ', amt(65000, 'Cafe')],
  ['cafe\n65k', amt(65000, 'Cafe')],
  // decomposed (NFD) accents, as some keyboards emit
  ['cafe sáu mươi lăm nghìn'.normalize('NFD'), amt(65000, 'Cafe')],
  ['Tài sâu 65.000 anh trả.', { amount: 65000, note: 'Tài sâu', emChi: false }],
  ['tăng tối 2,1 triệu.', amt(2100000, 'Tăng tối')],
  ['Mắc xe 588.000', amt(588000, 'Mắc xe')],
])

table('only an amount, only a payer, or nothing', [
  ['65k', amt(65000)],
  ['sáu mươi lăm nghìn', amt(65000)],
  ['anh trả', { note: '', emChi: false }],
  ['65k anh trả', { amount: 65000, note: '', emChi: false }],
  ['cafe', { note: 'Cafe' }],
  ['', { note: '' }],
  ['   ', { note: '' }],
  ['...', { note: '' }],
])

table('amounts that must not be invented', [
  ['cafe 0', { note: 'Cafe 0' }],
  ['cafe 0đ', { note: 'Cafe 0đ' }],
  ['cafe -65k', { note: 'Cafe -65k' }],
  ['cafe 65kg', { note: 'Cafe 65kg' }],
  ['cafe 1/2', { note: 'Cafe 1/2' }],
  ['12/11 cafe', { note: '12/11 cafe' }],
  ['gọi 0901234567', { note: 'Gọi 0901234567' }],
])

table('several amounts: the largest wins, the rest stay in the note', [
  ['cafe 65k bánh 30k', amt(65000, 'Cafe bánh 30k')],
  ['bánh 30k cafe 65k', amt(65000, 'Bánh 30k cafe')],
])

describe('robustness', () => {
  test('never throws and always returns a sane shape on random input', () => {
    const alphabet = ['65', 'k', 'nghìn', 'triệu', 'trăm', 'mươi', 'rưỡi', 'anh', 'em', 'trả', 'cho', 'chung',
      'hai', 'ba', 'đ', '.', ',', '1.000', '2tr5', 'cafe', 'làm', '₫', '', '-', '0', '999999999999999', 'tỷ', 'chục']
    let seed = 1
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let n = 0; n < 5000; n++) {
      const len = Math.floor(rnd() * 9)
      const text = Array.from({ length: len }, () => alphabet[Math.floor(rnd() * alphabet.length)]).join(rnd() < 0.5 ? ' ' : '')
      const r = parse(text)
      assert.equal(typeof r.note, 'string', text)
      if (r.amount !== undefined) {
        assert.ok(Number.isSafeInteger(r.amount) && r.amount > 0, `${text} -> ${r.amount}`)
      }
      if (r.emChi !== undefined) assert.equal(typeof r.emChi, 'boolean', text)
      if (r.forWhom !== undefined) assert.ok(['us', 'anh', 'em'].includes(r.forWhom), text)
    }
  })

  test('re-parsing the cleaned note never finds a second amount', () => {
    const inputs = ['cafe 65k anh trả', 'zone 2 coffee 65k', 'nhà một triệu rưỡi', '2 ly cafe 100k', 'quà 500k cho anh']
    for (const text of inputs) assert.equal(parse(parse(text).note).amount, undefined, text)
  })

  test('null and undefined input are safe', () => {
    assert.deepEqual(parse(null), { note: '' })
    assert.deepEqual(parse(undefined), { note: '' })
  })

  test('a very long note is still fast', () => {
    const t0 = performance.now()
    parse('cafe '.repeat(20000) + '65k')
    assert.ok(performance.now() - t0 < 500)
  })
})
