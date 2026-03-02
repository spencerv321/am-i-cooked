import { useState } from 'react'
import { getCompanyShareUrl, getCompanyLinkedInShareUrl, getCompanyCopyText, canNativeShare, companyNativeShare } from '../lib/shareText'
import { trackEvent } from '../lib/api'

export default function CompanyActionButtons({ companyName, score, status, onReset }) {
  const [shared, setShared] = useState(false)

  const handlePrimaryShare = async () => {
    trackEvent('company_share_primary')
    if (canNativeShare()) {
      const didShare = await companyNativeShare(companyName, score, status)
      if (didShare) {
        setShared(true)
        setTimeout(() => setShared(false), 2500)
      }
    } else {
      try {
        await navigator.clipboard.writeText(getCompanyCopyText(companyName, score, status))
      } catch {
        const textarea = document.createElement('textarea')
        textarea.value = getCompanyCopyText(companyName, score, status)
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setShared(true)
      setTimeout(() => setShared(false), 2500)
    }
  }

  const handleTwitter = () => {
    trackEvent('company_share_twitter')
    window.open(getCompanyShareUrl(companyName, score, status), '_blank', 'noopener')
  }

  const handleLinkedIn = () => {
    trackEvent('company_share_linkedin')
    window.open(getCompanyLinkedInShareUrl(companyName, score, status), '_blank', 'noopener')
  }

  const handleReset = () => {
    trackEvent('company_try_again')
    onReset()
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <button
        onClick={handlePrimaryShare}
        className={`w-full font-bold py-3 rounded-lg transition-all cursor-pointer text-sm ${
          shared
            ? 'bg-green-500/20 border border-green-500/50 text-green-400'
            : 'bg-white text-black hover:bg-gray-200'
        }`}
      >
        {shared ? '✓ Copied to clipboard!' : 'Share This Analysis'}
      </button>

      <div className="flex gap-2 w-full">
        <button
          onClick={handleTwitter}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dark-border text-gray-400 hover:border-gray-500 hover:text-white transition-colors cursor-pointer text-sm font-medium"
        >
          <span className="text-base leading-none">𝕏</span>
          <span>Post on X</span>
        </button>

        <button
          onClick={handleLinkedIn}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dark-border text-gray-400 hover:border-gray-500 hover:text-white transition-colors cursor-pointer text-sm font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          <span>Share on LinkedIn</span>
        </button>
      </div>

      <button
        onClick={handleReset}
        className="text-gray-500 hover:text-gray-300 text-sm font-mono transition-colors cursor-pointer mt-1"
      >
        ← Try another company
      </button>
    </div>
  )
}
