import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSpokenExpense as parse } from './parseSpoken.js'

const cases = [
  // digits
  ['cafe slow 65k anh trả', { amount: 65000, note: 'Cafe slow', emChi: false }],
  ['Cafe slow 65.000 em trả', { amount: 65000, note: 'Cafe slow', emChi: true }],
  ['bún mọc 80,000đ', { amount: 80000, note: 'Bún mọc' }],
  ['tiền chợ 1,5 triệu', { amount: 1500000, note: 'Tiền chợ' }],
  ['mua tủ lạnh 2tr6', { amount: 2600000, note: 'Mua tủ lạnh' }],
  ['grab anh đi làm 90 nghìn', { amount: 90000, note: 'Grab anh đi làm' }],
  ['xăng 200k cho em', { amount: 200000, note: 'Xăng', forWhom: 'em' }],
  ['ăn tối 2.100.000 đồng', { amount: 2100000, note: 'Ăn tối' }],
  // spoken words
  ['cafe slow sáu mươi lăm nghìn anh trả', { amount: 65000, note: 'Cafe slow', emChi: false }],
  ['grab đi làm chín chục', { amount: 90000, note: 'Grab đi làm' }],
  ['một triệu rưỡi tiền chợ', { amount: 1500000, note: 'Tiền chợ' }],
  ['bún mọc tám mươi nghìn em trả', { amount: 80000, note: 'Bún mọc', emChi: true }],
  ['massage năm trăm tám mươi tám nghìn', { amount: 588000, note: 'Massage' }],
  ['mua hoa quả một trăm năm mươi tám nghìn', { amount: 158000, note: 'Mua hoa quả' }],
  ['tiền xăng hai trăm nghìn', { amount: 200000, note: 'Tiền xăng' }],
  ['ăn tối hai triệu một trăm nghìn', { amount: 2100000, note: 'Ăn tối' }],
  ['hai trăm rưỡi nghìn tiền điện', { amount: 250000, note: 'Tiền điện' }],
  ['một triệu hai tiền nhà', { amount: 1200000, note: 'Tiền nhà' }],
  ['hai mươi lăm nghìn gửi xe', { amount: 25000, note: 'Gửi xe' }],
  // who/for whom
  ['quà sinh nhật cho anh 500k', { amount: 500000, note: 'Quà sinh nhật', forWhom: 'anh' }],
  ['siêu thị 700k chung', { amount: 700000, note: 'Siêu thị', forWhom: 'us' }],
  ['đặt cọc chung cư 5 triệu', { amount: 5000000, note: 'Đặt cọc chung cư' }],
  // words that look like numbers once accents are stripped
  ['tắm cho mèo 100k', { amount: 100000, note: 'Tắm cho mèo' }],
  ['mua muối 15k', { amount: 15000, note: 'Mua muối' }],
  ['đi làm bằng grab 45k', { amount: 45000, note: 'Đi làm bằng grab' }],
  // real (imperfect) Whisper-small transcripts from the spike
  ['Tài sâu 65.000 anh trả.', { amount: 65000, note: 'Tài sâu', emChi: false }],
  ['Mô hoa quả 158.000.', { amount: 158000, note: 'Mô hoa quả' }],
  ['tăng tối 2,1 triệu.', { amount: 2100000, note: 'Tăng tối' }],
  ['Mắc xe 588.000', { amount: 588000, note: 'Mắc xe' }],
  // nothing to parse
  ['cafe', { note: 'Cafe' }],
  ['mua quà cho ba', { note: 'Mua quà cho ba' }],
  ['', { note: '' }],
]

for (const [input, expected] of cases) {
  test(`parses: ${input || '(empty)'}`, () => {
    assert.deepEqual(parse(input), expected)
  })
}
