const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

export default function NumberPad({ onPress }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onPress(key)}
          className="rounded-xl bg-slate-900 py-4 text-xl font-medium text-slate-100 active:bg-slate-800"
        >
          {key}
        </button>
      ))}
    </div>
  )
}
