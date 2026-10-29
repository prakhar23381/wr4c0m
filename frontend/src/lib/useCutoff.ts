import { useMeta } from '../api/hooks'
import { isHHMM, toHHMM } from './time'
import { useSearchParam } from './useSearchParam'

const FALLBACK_CUTOFF = '09:50'

/** The decision cutoff (UK time on D-1), kept in the URL so it carries across pages. */
export function useCutoff(): [string, (cutoff: string) => void] {
  const meta = useMeta()
  const fallback = meta.data ? toHHMM(meta.data.default_cutoff) : FALLBACK_CUTOFF
  return useSearchParam('cutoff', fallback, isHHMM)
}
