import { useState, useEffect, useRef } from 'react'
import {
  getChallengeHeadline,
  getChallengeCopyText,
  getChallengeShareUrl,
  getChallengeLinkedInUrl,
  challengeNativeShare,
  canNativeShare,
} from '../lib/shareText'
import { trackEvent } from '../lib/api'

const AUTO_DISMISS_MS = 8000
const EXIT_ANIMATION_MS = 300

function getScoreColor(score) {
  const hue = 120 - (score / 100) * 120
  return `hsl(${hue}, 80%, 50%)`
}

export default function StickyShareCTA({ jobTitle, score, status, visible }) {
  const [dismissed, setDismissed] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [shared, setShared] = useState(false)
  const impressionFired = useRef(false)
  const autoDismissTimer = useRef(null)

  // Fire impression event once per result view
  useEffect(() => {
    if (visible && !dismissed && !impressionFired.current) {
      impressionFired.current = true
      trackEvent('sticky_cta_impression')
    }
  }, [visible, dismissed])

  // Auto-dismiss timer
  useEffect(() => {
    if (visible && !dismissed && !dismissing) {
      autoDismissTimer.current = setTimeout(() => {
        trackEvent('sticky_cta_autodismiss')
        triggerDismiss()
      }, AUTO_DISMISS_MS)
      return () => clearTimeout(autoDismissTimer.current)
    }
  }, [visible, dismissed, dismissing])

  // Reset when visible goes false (new result coming)
  useEffect(() => {
    if (!visible) {
      setDismissed(false)
      setDismissing(false)
      setShared(false)
      impressionFired.current = false
    }
  }, [visible])

  function triggerDismiss() {
    if (dismissing) return
    clearTimeout(autoDismissTimer.current)
    setDismissing(true)
    setTimeout(() => setDismissed(true), EXIT_ANIMATION_MS)
  }

  const handleDismiss = () => {
    trackEvent('sticky_cta_dismiss')
    triggerDismiss()
  }

  const handlePrimaryShare = async () => {
    trackEvent('sticky_cta_share')
    if (canNativeShare()) {
      await challengeNativeShare(jobTitle, score, status)
      triggerDismiss()
    } else {
      const text = getChallengeCopyText(jobTitle, score, status)
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        const textarea = document.createElement('textarea')
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setShared(true)
      setTimeout(() => {
        setShared(false)
        triggerDismiss()
      }, 2000)
    }
  }

  const handleTwitter = () => {
    trackEvent('sticky_cta_twitter')
    window.open(getChallengeShareUrl(jobTitle, score, status), '_blank', 'noopener')
    triggerDismiss()
  }

  const handleLinkedIn = () => {
    trackEvent('sticky_cta_linkedin')
    window.open(getChallengeLinkedInUrl(jobTitle, score, status), '_blank', 'noopener')
    triggerDismiss()
  }

  // Don't render if not visible or already dismissed
  if (!visible || dismissed) return null

  const headline = getChallengeHeadline(score)
  const color = getScoreColor(score)

  return (
    <div
      role="complementary"
      aria-label="Share your result"
      className={`fixed bottom-0 left-0 right-0 z-50 mx-3 mb-3 sm:mx-auto sm:max-w-lg p-4 bg-dark-card/95 backdrop-blur-sm border border-dark-border rounded-xl shadow-[0_-4px_20px_rgba(0,0,0,0.5)] ${
        dismissing ? 'animate-slide-out-bottom' : 'animate-slide-in-bottom'
      }`}
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss share prompt"
        className="absolute top-2.5 right-3 text-gray-500 hover:text-white transition-colors cursor-pointer text-lg leading-none"
      >
        ×
      </button>

      {/* Score + headline */}
      <div className="flex items-center gap-3 mb-3 pr-6">
        <span
          className="text-3xl font-black font-mono tabular-nums shrink-0"
          style={{ color }}
        >
          {score}
        </span>
        <p className="text-gray-300 text-sm font-medium leading-snug">
          {headline}
        </p>
      </div>

      {/* Share buttons */}
      <div className="flex gap-2">
        <button
          onClick={handlePrimaryShare}
          className={`flex-1 font-bold py-2.5 rounded-lg transition-all cursor-pointer text-sm ${
            shared
              ? 'bg-green-500/20 border border-green-500/50 text-green-400'
              : 'bg-white text-black hover:bg-gray-200'
          }`}
        >
          {shared ? '✓ Copied!' : '🔥 Challenge a Friend'}
        </button>

        <button
          onClick={handleTwitter}
          className="flex items-center justify-center w-11 py-2.5 rounded-lg border border-dark-border text-gray-400 hover:border-gray-500 hover:text-white transition-colors cursor-pointer text-base"
        >
          𝕏
        </button>

        <button
          onClick={handleLinkedIn}
          className="flex items-center justify-center w-11 py-2.5 rounded-lg border border-dark-border text-gray-400 hover:border-gray-500 hover:text-white transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        </button>
      </div>
    </div>
  )
}
