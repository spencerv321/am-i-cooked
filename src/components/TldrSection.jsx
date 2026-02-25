export default function TldrSection({ text }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-4 sm:p-5">
      <h3 className="font-mono text-xs uppercase tracking-widest mb-2 text-gray-500">
        TL;DR
      </h3>
      <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
        {text}
      </p>
    </div>
  )
}
