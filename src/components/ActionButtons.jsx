import { useState } from 'react'
import { getShareUrl, getLinkedInShareUrl, getCopyText, canNativeShare, nativeShare } from '../lib/shareText'

export default function ActionButtons({ jobTitle, score, onReset }) {
  const [copied, setCopied] = useState(false)

  const handleTwitter = () => {
    window.open(getShareUrl(jobTitle, score), '_blank', 'noopener')
  }

  const handleLinkedIn = () => {
    window.open(getLinkedInShareUrl(jobTitle, score), '_blank', 'noopener')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getCopyText(jobTitle, score))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = getCopyText(jobTitle, score)
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleNativeShare = () => {
    nativeShare(jobTitle, score)
  }

  const showNativeShare = canNativeShare()

  return (
    <div className="flex flex-col gap-3 w-full">
      <button
        onClick={onReset}
        className="w-full border border-gray-600 text-gray-300 font-semibold px-6 py-3 rounded-lg hover:border-white hover:text-white transition-colors cursor-pointer"
      >
        Try Again
      </button>

      <div className="flex gap-2 w-full">
        {/* Twitter/X */}
        <button
          onClick={handleTwitter}
          className="flex-1 bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-sm flex items-center justify-center gap-1.5"
          title="Share on X"
        >
          <span className="text-base">𝕏</span>
          <span className="hidden sm:inline">Share</span>
        </button>

        {/* LinkedIn */}
        <button
          onClick={handleLinkedIn}
          className="flex-1 bg-[#0A66C2] text-white font-bold py-3 rounded-lg hover:bg-[#004182] transition-colors cursor-pointer text-sm flex items-center justify-center gap-1.5"
          title="Share on LinkedIn"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          <span className="hidden sm:inline">Share</span>
        </button>

        {/* Copy */}
        <button
          onClick={handleCopy}
          className={`flex-1 font-bold py-3 rounded-lg transition-colors cursor-pointer text-sm flex items-center justify-center gap-1.5 border ${
            copied
              ? 'bg-green-500/20 border-green-500/50 text-green-400'
              : 'bg-transparent border-gray-600 text-gray-300 hover:border-white hover:text-white'
          }`}
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span className="hidden sm:inline">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              <span className="hidden sm:inline">Copy</span>
            </>
          )}
        </button>

        {/* Native Share (mobile only) */}
        {showNativeShare && (
          <button
            onClick={handleNativeShare}
            className="flex-1 font-bold py-3 rounded-lg transition-colors cursor-pointer text-sm flex items-center justify-center gap-1.5 border border-gray-600 text-gray-300 hover:border-white hover:text-white"
            title="Share"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <span className="hidden sm:inline">Share</span>
          </button>
        )}
      </div>
    </div>
  )
}
