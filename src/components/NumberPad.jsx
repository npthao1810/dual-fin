export default function NumberPad({ onPress, allowDecimal = false }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', allowDecimal ? '.' : '000', '0', '⌫']
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onPress(key)}
          className="rounded-2xl border border-pink-100 bg-white py-3 text-xl font-bold text-stone-700 shadow-sm active:bg-pink-50"
        >
          {key}
        </button>
      ))}
    </div>
  )
}
