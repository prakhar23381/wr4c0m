import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'

import { decision, meta } from '../test/fixtures'
import { DecisionPage } from './DecisionPage'

// ECharts needs a real layout engine; the chart itself is covered by decisionChart.test.ts.
vi.mock('../components/EChart', () => ({
  EChart: ({ label }: { label: string }) => <div role="img" aria-label={label} />,
}))

const responses: Record<string, unknown> = {
  '/api/meta': meta,
  '/api/decision': decision,
  '/api/accuracy/breakdown': { by: 'day', basis: '', bucket_width: null, rows: [] },
}

afterEach(() => vi.unstubAllGlobals())

it('shows the forecast used at the cutoff and the day summary', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = url.split('?')[0]
      return new Response(JSON.stringify(responses[path]), { status: path in responses ? 200 : 404 })
    }),
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/?date=2026-01-28']}>
        <DecisionPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

  expect(await screen.findByText('Wednesday 28 January 2026')).toBeInTheDocument()
  expect(screen.getByText(/Tue,? 27 Jan, 09:30 GMT/)).toBeInTheDocument()
  expect(screen.getByText('22,000 MWh')).toBeInTheDocument()
  expect(screen.getByText('−2,500 MW')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: /Hourly wind forecast for/ })).toBeInTheDocument()
})
