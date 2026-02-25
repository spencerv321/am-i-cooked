import { useState, useEffect } from 'react'
import './index.css'
import { analyzeJob } from './lib/api'
import InputSection from './components/InputSection'
import LoadingState from './components/LoadingState'
import ResultCard from './components/ResultCard'
import Footer from './components/Footer'

function App() {
  const [appState, setAppState] = useState('idle')
  const [jobTitle, setJobTitle] = useState('')
  const [resultData, setResultData] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (title) => {
    setJobTitle(title)
    setAppState('loading')
    setError(null)
    try {
      const data = await analyzeJob(title)
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
  }

  const isResult = appState === 'result'

  return (
    <div
      className={`min-h-screen bg-dark flex flex-col items-center px-4 py-8 sm:py-12 font-display ${
        isResult ? 'justify-start pt-8 sm:pt-12' : 'justify-center'
      }`}
    >
      {appState === 'idle' && (
        <InputSection onSubmit={handleSubmit} error={error} />
      )}
      {appState === 'loading' && <LoadingState />}
      {isResult && resultData && (
        <ResultCard data={resultData} jobTitle={jobTitle} onReset={handleReset} />
      )}
      <Footer />
    </div>
  )
}

export default App
