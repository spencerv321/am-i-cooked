import { useState, useEffect } from 'react'
import './index.css'
import { analyzeJob, analyzeCompany, trackEvent } from './lib/api'
import InputSection from './components/InputSection'
import LoadingState from './components/LoadingState'
import ResultCard from './components/ResultCard'
import CompareResult from './components/CompareResult'
import CompanyResultCard from './components/CompanyResultCard'
import Leaderboard from './components/Leaderboard'
import LiveFeed from './components/LiveFeed'
import StickyShareCTA from './components/StickyShareCTA'
import Footer from './components/Footer'

// Read ?job= or ?compare= or ?company= query param synchronously so it's available on first render
function getInitialParams() {
  const params = new URLSearchParams(window.location.search)
  const job = params.get('job')
  const compare = params.get('compare')
  const company = params.get('company')
  if (job || compare || company) {
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
  }
  if (company) {
    return { job1: '', job2: '', company }
  }
  if (compare) {
    const [job1, job2] = compare.split(',').map(s => s.trim())
    return { job1: job1 || '', job2: job2 || '' }
  }
  return { job1: job || '', job2: '', company: '' }
}

function LaunchBanner({ onTryCompany, onDismiss }) {
  return (
    <button
      onClick={() => { trackEvent('launch_banner_click'); onTryCompany() }}
      className="group fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600/90 via-purple-600/90 to-blue-600/90 backdrop-blur-sm border-b border-white/10 px-4 py-2 sm:py-2.5 flex items-center justify-center gap-2 cursor-pointer hover:from-blue-500/90 hover:via-purple-500/90 hover:to-blue-500/90 transition-all"
    >
      <span className="text-xs sm:text-sm font-mono text-white/90 tracking-wide">
        <span className="font-bold text-white">NEW</span>
        <span className="mx-2 text-white/40">|</span>
        Is your company cooked? Find out now
        <span className="inline-block ml-1 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
      </span>
      <span
        onClick={(e) => { e.stopPropagation(); onDismiss() }}
        className="absolute right-3 sm:right-4 text-white/40 hover:text-white/80 text-sm cursor-pointer px-1"
        aria-label="Dismiss"
      >
        &times;
      </span>
    </button>
  )
}

function App() {
  const [initial] = useState(getInitialParams)
  const [mode, setMode] = useState(initial.company ? 'company' : 'job')
  const [appState, setAppState] = useState('idle')
  const [jobTitle, setJobTitle] = useState(initial.job1)
  const [resultData, setResultData] = useState(null)
  const [error, setError] = useState(null)

  const [scoreAnimDone, setScoreAnimDone] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  // Compare mode state
  const [compareJobs, setCompareJobs] = useState({ job1: '', job2: '' })
  const [compareData, setCompareData] = useState(null)

  // Company mode state
  const [companyName, setCompanyName] = useState('')
  const [companyData, setCompanyData] = useState(null)

  // Hash routing — check on mount and listen for changes
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#leaderboard' && appState === 'idle') {
        setAppState('leaderboard')
      }
    }
    checkHash()
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [appState])

  const handleSubmit = async (title, tone = null) => {
    setJobTitle(title)
    setAppState('loading')
    setScoreAnimDone(false)
    setError(null)
    window.location.hash = ''
    try {
      const data = await analyzeJob(title, tone)
      setResultData(data)
      setAppState('result')
    } catch (err) {
      setError(err.message)
      setAppState('idle')
    }
  }

  const handleCompare = async (job1, job2, tone = null) => {
    trackEvent('compare_submit')
    setCompareJobs({ job1, job2 })
    setAppState('compare-loading')
    setError(null)
    window.location.hash = ''
    try {
      const [data1, data2] = await Promise.all([
        analyzeJob(job1, tone),
        analyzeJob(job2, tone),
      ])
      setCompareData({ job1: { title: job1, ...data1 }, job2: { title: job2, ...data2 } })
      setAppState('compare-result')
    } catch (err) {
      setError(err.message)
      setAppState('idle')
    }
  }

  const handleCompanySubmit = async (name) => {
    trackEvent('company_analyze')
    setCompanyName(name)
    setAppState('company-loading')
    setScoreAnimDone(false)
    setError(null)
    window.location.hash = ''
    try {
      const data = await analyzeCompany(name)
      setCompanyData(data)
      setAppState('company-result')
    } catch (err) {
      setError(err.message)
      setAppState('idle')
    }
  }

  // Auto-trigger on mount if URL had params
  useEffect(() => {
    if (initial.company) {
      handleCompanySubmit(initial.company)
    } else if (initial.job2 && initial.job1) {
      handleCompare(initial.job1, initial.job2)
    } else if (initial.job1 && !initial.job2) {
      handleSubmit(initial.job1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll to top when results load so the score is visible
  useEffect(() => {
    if (appState === 'result' || appState === 'compare-result' || appState === 'company-result') {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [appState])

  const handleReset = () => {
    setAppState('idle')
    setResultData(null)
    setCompareData(null)
    setCompanyData(null)
    setScoreAnimDone(false)
    setJobTitle('')
    setCompareJobs({ job1: '', job2: '' })
    setCompanyName('')
    setError(null)
    window.location.hash = ''
  }

  const handleSwitchToCompany = () => {
    handleReset()
    setMode('company')
  }

  const handleSwitchToJob = () => {
    handleReset()
    setMode('job')
  }

  const handleShowLeaderboard = () => {
    setAppState('leaderboard')
    setResultData(null)
    setCompareData(null)
    setCompanyData(null)
    setError(null)
    window.location.hash = 'leaderboard'
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const handleLeaderboardAnalyze = (title) => {
    window.location.hash = ''
    handleSubmit(title)
  }

  const isResult = appState === 'result'
  const isCompareResult = appState === 'compare-result'
  const isCompanyResult = appState === 'company-result'
  const showBanner = appState === 'idle' && mode === 'job' && !bannerDismissed

  return (
    <div
      className={`min-h-screen bg-dark flex flex-col items-center px-4 py-8 sm:py-12 font-display ${
        isResult || isCompareResult || isCompanyResult ? 'justify-start pt-8 sm:pt-12' : 'justify-center'
      } ${showBanner ? 'pt-14 sm:pt-16' : ''}`}
    >
      {showBanner && (
        <LaunchBanner onTryCompany={handleSwitchToCompany} onDismiss={() => setBannerDismissed(true)} />
      )}
      {appState === 'idle' && (
        <>
          <InputSection
            onSubmit={handleSubmit}
            onCompare={handleCompare}
            onCompanySubmit={handleCompanySubmit}
            error={error}
            onShowLeaderboard={handleShowLeaderboard}
            defaultValue={jobTitle}
            mode={mode}
            onModeChange={setMode}
          />
          <LiveFeed mode={mode} />
        </>
      )}
      {(appState === 'loading' || appState === 'compare-loading') && <LoadingState mode="job" />}
      {appState === 'company-loading' && <LoadingState mode="company" />}
      {isResult && resultData && (
        <>
          <ResultCard data={resultData} jobTitle={jobTitle} onReset={handleReset} onShowLeaderboard={handleShowLeaderboard} onAnimationDone={() => setScoreAnimDone(true)} onSwitchToCompany={handleSwitchToCompany} />
          <StickyShareCTA
            jobTitle={jobTitle}
            score={resultData.score}
            status={resultData.status}
            visible={scoreAnimDone}
          />
        </>
      )}
      {isCompareResult && compareData && (
        <CompareResult data={compareData} onReset={handleReset} onShowLeaderboard={handleShowLeaderboard} />
      )}
      {isCompanyResult && companyData && (
        <CompanyResultCard
          data={companyData}
          companyName={companyName}
          onReset={handleReset}
          onSwitchToJob={handleSwitchToJob}
          onAnimationDone={() => setScoreAnimDone(true)}
        />
      )}
      {appState === 'leaderboard' && (
        <Leaderboard onAnalyzeJob={handleLeaderboardAnalyze} onGoHome={handleReset} />
      )}
      <Footer />
    </div>
  )
}

export default App
