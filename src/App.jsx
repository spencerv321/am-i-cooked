import { useState, useEffect } from 'react'
import './index.css'
import { analyzeJob } from './lib/api'
import InputSection from './components/InputSection'
import LoadingState from './components/LoadingState'
import ResultCard from './components/ResultCard'
import Leaderboard from './components/Leaderboard'
import LiveFeed from './components/LiveFeed'
import Footer from './components/Footer'

// Read ?job= query param synchronously so it's available on first render
function getInitialJob() {
  const params = new URLSearchParams(window.location.search)
  const job = params.get('job')
  if (job) {
    // Clean the URL without reloading
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
    return job
  }
  return ''
}

function App() {
  const [appState, setAppState] = useState('idle')
  const [jobTitle, setJobTitle] = useState(getInitialJob)
  const [resultData, setResultData] = useState(null)
  const [error, setError] = useState(null)

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

  // Scroll to top when results load so the score is visible
  useEffect(() => {
    if (appState === 'result') {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [appState])

  const handleReset = () => {
    setAppState('idle')
    setResultData(null)
    setJobTitle('')
    setError(null)
    window.location.hash = ''
  }

  const handleShowLeaderboard = () => {
    setAppState('leaderboard')
    setResultData(null)
    setError(null)
    window.location.hash = 'leaderboard'
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const handleLeaderboardAnalyze = (title) => {
    window.location.hash = ''
    handleSubmit(title)
  }

  const isResult = appState === 'result'

  return (
    <div
      className={`min-h-screen bg-dark flex flex-col items-center px-4 py-8 sm:py-12 font-display ${
        isResult ? 'justify-start pt-8 sm:pt-12' : 'justify-center'
      }`}
    >
      {appState === 'idle' && (
        <>
          <InputSection onSubmit={handleSubmit} error={error} onShowLeaderboard={handleShowLeaderboard} defaultValue={jobTitle} />
          <LiveFeed />
        </>
      )}
      {appState === 'loading' && <LoadingState />}
      {isResult && resultData && (
        <ResultCard data={resultData} jobTitle={jobTitle} onReset={handleReset} onShowLeaderboard={handleShowLeaderboard} />
      )}
      {appState === 'leaderboard' && (
        <Leaderboard onAnalyzeJob={handleLeaderboardAnalyze} onGoHome={handleReset} />
      )}
      <Footer />
    </div>
  )
}

export default App
