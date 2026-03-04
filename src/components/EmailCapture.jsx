import { useState, useEffect } from 'react'
import { subscribeEmail, trackEvent } from '../lib/api'

const LS_KEY = 'cooked_email'

function getStoredEmail() {
  try { return localStorage.getItem(LS_KEY) || '' } catch { return '' }
}

function storeEmail(email) {
  try { localStorage.setItem(LS_KEY, email) } catch {}
}

export default function EmailCapture({ title, score, type = 'job' }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('')
  const [savedEmail, setSavedEmail] = useState('')

  useEffect(() => {
    setSavedEmail(getStoredEmail())
  }, [])

  const isCompact = savedEmail && status === 'idle'

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    const submitEmail = isCompact ? savedEmail : email.trim()

    if (!submitEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitEmail)) {
      setErrorMsg('Please enter a valid email.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setErrorMsg('')

    try {
      await subscribeEmail(submitEmail, title, score, type)
      trackEvent('email_capture_submit')
      storeEmail(submitEmail)
      setSavedEmail(submitEmail)
      setStatus('success')
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="w-full bg-dark-card border border-dark-border rounded-lg p-4 text-center">
        <p className="text-green-400 font-mono text-sm font-bold">
          You're in.
        </p>
        <p className="text-gray-400 text-xs mt-1">
          We'll ping you if things shift for <span className="text-white capitalize">{title}</span>.
        </p>
      </div>
    )
  }

  // Compact mode — returning subscriber
  if (isCompact) {
    return (
      <div className="w-full bg-amber-500/[0.04] border border-amber-500/30 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-gray-300 text-sm truncate">
          Track <span className="text-white font-medium capitalize">{title}</span> too?
        </span>
        <button
          onClick={handleSubmit}
          disabled={status === 'loading'}
          className="bg-white text-black font-mono text-xs font-bold px-4 py-1.5 rounded-md hover:bg-gray-200 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
        >
          {status === 'loading' ? '...' : 'Track This'}
        </button>
      </div>
    )
  }

  // Full form mode
  const isJob = type === 'job'

  return (
    <div className="w-full bg-amber-500/[0.04] border border-amber-500/30 rounded-lg p-4 sm:p-5">
      <h3 className="text-white font-bold text-sm sm:text-base mb-1">
        {isJob ? 'Your score changed? We\'ll tell you.' : 'AI moves fast. We\'ll keep you posted.'}
      </h3>
      <p className="text-gray-400 text-xs sm:text-sm mb-3">
        {isJob
          ? <>We track AI developments and update scores. Drop your email and we'll alert you if <span className="text-white capitalize">{title}</span>'s risk level shifts.</>
          : <>We track AI disruption across industries. Drop your email and we'll alert you if <span className="text-white capitalize">{title}</span>'s outlook shifts.</>
        }
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setStatus('idle') }}
          placeholder="your@email.com"
          className="flex-1 bg-black/30 border border-dark-border rounded-md px-3 py-2 text-sm font-mono text-white placeholder:text-gray-600 focus:outline-none focus:border-gray-500 transition-colors min-w-0"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="bg-white text-black font-mono text-xs font-bold px-4 py-2 rounded-md hover:bg-gray-200 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
        >
          {status === 'loading' ? '...' : 'Alert Me'}
        </button>
      </form>

      {status === 'error' && errorMsg && (
        <p className="text-red-400 text-xs font-mono mt-2">{errorMsg}</p>
      )}

      <p className="text-gray-600 text-[10px] font-mono mt-2">
        No spam. Just a heads up when things change.
      </p>
    </div>
  )
}
