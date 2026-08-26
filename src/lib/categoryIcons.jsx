const KEYWORD_EMOJIS = [
  { keywords: ['food', 'ăn', 'meal', 'lunch', 'dinner', 'breakfast', 'nem', 'cơm'], emoji: '🍔' },
  { keywords: ['coffee', 'cà phê', 'cafe', 'trà sữa'], emoji: '☕' },
  { keywords: ['rent', 'nhà', 'housing'], emoji: '🏠' },
  { keywords: ['transport', 'xe', 'gas', 'xăng', 'grab', 'taxi'], emoji: '🚗' },
  { keywords: ['shopping', 'mua sắm', 'clothes', 'quần áo'], emoji: '🛍️' },
  { keywords: ['health', 'sức khỏe', 'medicine', 'thuốc', 'doctor'], emoji: '💊' },
  { keywords: ['travel', 'du lịch', 'trip'], emoji: '✈️' },
  { keywords: ['entertainment', 'giải trí', 'movie', 'phim', 'game'], emoji: '🎬' },
  { keywords: ['education', 'học', 'book', 'sách', 'course'], emoji: '📚' },
  { keywords: ['bill', 'hóa đơn', 'electric', 'điện', 'water', 'nước', 'internet'], emoji: '🧾' },
  { keywords: ['gift', 'quà'], emoji: '🎁' },
  { keywords: ['pet', 'thú cưng', 'cat', 'mèo', 'dog', 'chó'], emoji: '🐾' },
  { keywords: ['beauty', 'làm đẹp', 'spa', 'hair', 'tóc'], emoji: '💅' },
  { keywords: ['grocery', 'groceries', 'chợ', 'siêu thị', 'market'], emoji: '🛒' },
  { keywords: ['phone', 'điện thoại', 'mobile'], emoji: '📱' },
]

const FALLBACK_EMOJIS = ['💰', '🧩', '🌟', '🔖', '📦', '🎯', '🧸', '🪄', '🎨', '🧃']

export function guessCategoryEmoji(name) {
  const lower = name.trim().toLowerCase()
  for (const { keywords, emoji } of KEYWORD_EMOJIS) {
    if (keywords.some((k) => lower.includes(k))) return emoji
  }
  return null
}

export function fallbackEmojiFor(seed) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return FALLBACK_EMOJIS[hash % FALLBACK_EMOJIS.length]
}

export function categoryIcon(category) {
  if (!category) {
    return (
      <img src="/icons/nav/uncategorized.png" alt="Uncategorized" className="inline-block h-5 w-5 align-middle" />
    )
  }
  if (category.icon) return category.icon
  return guessCategoryEmoji(category.name) ?? fallbackEmojiFor(category.id ?? category.name)
}
