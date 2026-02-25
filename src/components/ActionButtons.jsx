import { getShareUrl } from '../lib/shareText'

export default function ActionButtons({ jobTitle, score, onReset }) {
  const handleShare = () => {
    window.open(getShareUrl(jobTitle, score), '_blank', 'noopener')
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full">
      <button
        onClick={onReset}
        className="flex-1 border border-gray-600 text-gray-300 font-semibold px-6 py-3 rounded-lg hover:border-white hover:text-white transition-colors cursor-pointer"
      >
        Try Again
      </button>
      <button
        onClick={handleShare}
        className="flex-1 bg-white text-black font-bold px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
      >
        Share on 𝕏
      </button>
    </div>
  )
}
