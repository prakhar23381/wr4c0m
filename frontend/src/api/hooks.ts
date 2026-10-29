import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getJson } from './client'
import type {
  AccuracySummary,
  BreakdownBy,
  BreakdownResponse,
  CutoffSweepResponse,
  DecisionResponse,
  DistributionResponse,
  Meta,
  VintagesResponse,
} from './types'

// The data is a fixed snapshot, so responses never go stale within a session.
export const useMeta = () =>
  useQuery({ queryKey: ['meta'], queryFn: () => getJson<Meta>('/meta') })

export const useDecision = (deliveryDate: string, cutoff: string) =>
  useQuery({
    queryKey: ['decision', deliveryDate, cutoff],
    queryFn: () => getJson<DecisionResponse>('/decision', { delivery_date: deliveryDate, cutoff }),
    placeholderData: keepPreviousData,
  })

export const useVintages = (deliveryDate: string, cutoff: string, enabled: boolean) =>
  useQuery({
    queryKey: ['vintages', deliveryDate, cutoff],
    queryFn: () => getJson<VintagesResponse>('/vintages', { delivery_date: deliveryDate, cutoff }),
    enabled,
  })

export const useAccuracySummary = (cutoff: string) =>
  useQuery({
    queryKey: ['accuracy', 'summary', cutoff],
    queryFn: () => getJson<AccuracySummary>('/accuracy/summary', { cutoff }),
    placeholderData: keepPreviousData,
  })

export const useBreakdown = (by: BreakdownBy, cutoff: string) => {
  // Lead-time accuracy uses every publish, so it does not depend on the cutoff.
  const params = { by, cutoff: by === 'lead_time' ? undefined : cutoff }
  return useQuery({
    queryKey: ['accuracy', 'breakdown', params],
    queryFn: () => getJson<BreakdownResponse>('/accuracy/breakdown', params),
    placeholderData: keepPreviousData,
  })
}

export const useDistribution = (cutoff: string) =>
  useQuery({
    queryKey: ['accuracy', 'distribution', cutoff],
    queryFn: () => getJson<DistributionResponse>('/accuracy/distribution', { cutoff }),
    placeholderData: keepPreviousData,
  })

export const useCutoffSweep = () =>
  useQuery({
    queryKey: ['accuracy', 'cutoffs'],
    queryFn: () => getJson<CutoffSweepResponse>('/accuracy/cutoffs'),
  })
