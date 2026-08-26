const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫']

export default function NumberPad({ onPress }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onPress(key)}
          className="rounded-2xl border border-pink-100 bg-white py-4 text-xl font-bold text-stone-700 shadow-sm active:bg-pink-50"
        >
          {key}
        </button>
      ))}
    </div>
  )
}
