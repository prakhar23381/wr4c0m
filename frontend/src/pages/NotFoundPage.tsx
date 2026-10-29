import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-ink-2">That address doesn't match a page in this app.</p>
      <Link to="/" className="mt-4 inline-block text-forecast underline">
        Go to the decision view
      </Link>
    </div>
  )
}
