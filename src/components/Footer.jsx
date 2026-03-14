import { trackEvent } from '../lib/api'

export default function Footer() {
  return (
    <footer className="mt-12 text-center text-gray-600 text-xs font-mono space-y-2">
      <p>
        Check out{' '}
        <a
          href="https://arewecooked.io"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent('arewecooked_footer_click')}
          className="text-gray-400 hover:text-white transition-colors underline decoration-gray-600 underline-offset-2 hover:decoration-gray-400"
        >
          Are We Cooked?
        </a>
        {' '}&mdash; the bigger picture
      </p>
      <p>
        Powered by Claude &middot; Built by{' '}
        <a
          href="https://x.com/spencervail"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-white transition-colors"
        >
          @spencervail
        </a>
      </p>
    </footer>
  )
}
