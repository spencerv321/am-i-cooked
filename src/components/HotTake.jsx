export default function HotTake({ text }) {
  return (
    <blockquote className="border-l-4 border-warning pl-4 sm:pl-5 py-1">
      <p className="text-gray-200 text-base sm:text-lg italic leading-relaxed">
        &ldquo;{text}&rdquo;
      </p>
    </blockquote>
  )
}
