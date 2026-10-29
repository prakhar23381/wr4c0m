import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

/** A query-string value with a fallback; setting it replaces the history entry. */
export function useSearchParam(
  name: string,
  fallback: string,
  isValid: (value: string) => boolean = () => true,
): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get(name)
  const value = raw !== null && isValid(raw) ? raw : fallback
  const setValue = useCallback(
    (next: string) =>
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          updated.set(name, next)
          return updated
        },
        { replace: true },
      ),
    [name, setParams],
  )
  return [value, setValue]
}
