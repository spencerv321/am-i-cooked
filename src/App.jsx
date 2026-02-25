import { useState } from 'react'
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

  const handleReset = () => {
    setAppState('idle')
    setResultData(null)
    setJobTitle('')
    setError(null)
  }

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center px-4 py-8 font-display">
      {appState === 'idle' && (
        <InputSection onSubmit={handleSubmit} error={error} />
      )}
      {appState === 'loading' && <LoadingState />}
      {appState === 'result' && resultData && (
        <ResultCard data={resultData} jobTitle={jobTitle} onReset={handleReset} />
      )}
      <Footer />
    </div>
  )
}

export default App
