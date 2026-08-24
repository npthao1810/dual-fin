export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount ?? 0)
}

export function currentMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start: toISODate(start), end: toISODate(end) }
}

export function toISODate(date) {
  return date.toISOString().slice(0, 10)
}

export function firstOfMonth(date = new Date()) {
  return toISODate(new Date(date.getFullYear(), date.getMonth(), 1))
}
