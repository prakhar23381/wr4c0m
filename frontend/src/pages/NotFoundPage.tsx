import { Chapter, ChevronLink } from '../components/ui'

export function NotFoundPage() {
  return (
    <Chapter tone="hero" inner="sm:py-28">
      <p className="text-eyebrow text-ink-2">404</p>
      <h1 className="text-display mt-2 text-ink">Page not found.</h1>
      <p className="text-lead mt-4 text-ink-2">That address doesn't match a page in this app.</p>
      <div className="mt-6">
        <ChevronLink to="/">Go to the decision view</ChevronLink>
      </div>
    </Chapter>
  )
}
