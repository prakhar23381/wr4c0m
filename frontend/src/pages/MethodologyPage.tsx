import type { ReactNode } from 'react'

import { useMeta } from '../api/hooks'
import { Chapter } from '../components/ui'
import { formatDateShort, formatDayTime, toHHMM } from '../lib/time'

const REPO_URL = 'https://github.com/prakhar23381/wr4c0m'

/** One spec-sheet section: short terms on the left, one-line answers on the right. */
function Sheet({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <section className="grid gap-x-10 gap-y-4 border-t border-line py-8 first:border-0 first:pt-0 md:grid-cols-[200px_1fr]">
      <h2 className="text-title text-ink">{title}</h2>
      <dl className="text-body divide-y divide-line">
        {rows.map(([term, answer]) => (
          <div key={term} className="grid gap-x-6 gap-y-0.5 py-3 first:pt-0 sm:grid-cols-[150px_1fr]">
            <dt className="font-semibold text-ink">{term}</dt>
            <dd className="text-ink-2">{answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

const link = 'text-link hover:underline'

export function MethodologyPage() {
  const meta = useMeta().data
  const presets = meta?.cutoff_presets ?? []

  return (
    <>
      <Chapter tone="hero" inner="sm:py-24">
        <p className="text-eyebrow text-ink-2">Methodology</p>
        <h1 className="text-display mt-2 text-ink">How the numbers are made.</h1>
      </Chapter>

      <Chapter tone="light">
        <Sheet
          title="The question"
          rows={[
            ['Decision', 'Buy tomorrow’s power on the day-ahead market, which closes the day before.'],
            ['Risk', 'Forecast wind that doesn’t come must be bought later, usually at a worse price.'],
            ['So', 'What did the forecast say at decision time, and how far can it be trusted?'],
          ]}
        />
        <Sheet
          title="Data"
          rows={[
            ['Actual wind', 'Elexon FUELHH, fuel type WIND. Metered, half-hourly, MW.'],
            ['Forecast', 'Elexon WINDFOR. Hourly, published about 8 times a day.'],
            [
              'Scope',
              meta
                ? `Decisions made in January 2026 (delivery ${formatDateShort(meta.delivery_first_day)} – ${formatDateShort(meta.delivery_last_day)}). No other data.`
                : 'Decisions made in January 2026. No other data.',
            ],
            [
              'Snapshot',
              meta
                ? `Built ${formatDayTime(meta.data_built_at)}, ${meta.forecast_publishes} forecast publishes, quality-checked. Late publishes count from when they appeared.`
                : 'Downloaded once and quality-checked.',
            ],
          ]}
        />
        <Sheet
          title="Decision time"
          rows={[
            ['Rule', 'The latest forecast published at or before the decision time on D−1. No look-ahead.'],
            ...presets.map((p): [string, ReactNode] => [`${p.label.split(' ')[0]} ${toHHMM(p.time)}`, `${p.note}.`]),
            ['Default', '09:50 uses the 09:30 forecast, 14.5–37.5 h ahead.'],
          ]}
        />
        <Sheet
          title="Metrics"
          rows={[
            ['Error', 'Actual − forecast. Negative means less wind than forecast.'],
            ['Average miss', 'MAE: the average size of the error.'],
            ['RMSE', 'Like MAE, but large misses count more.'],
            ['Bias', 'The average error: a systematic lean.'],
            ['WAPE', 'Σ|error| ÷ Σ actual. Avoids MAPE’s blow-up in calm hours.'],
            ['Buffer', '−P10 of errors: covers the shortfall 9 hours in 10.'],
            ['Matching', 'Each forecast hour vs the half-hour starting on the hour. Averaging both changes MAE by under 1%.'],
            ['Hours ahead', 'Uses every forecast, not only decision-time ones.'],
          ]}
        />
        <Sheet
          title="Likely range"
          rows={[
            ['Band', 'Forecast + P10 / P50 / P90 of past errors at a similar level (4 GW buckets), floored at 0.'],
            ['Fair test', 'The day on screen is left out of its own band.'],
            ['Caveat', 'Built from the same month: illustrative, not validated.'],
          ]}
        />
        <Sheet
          title="Limitations"
          rows={[
            ['Sample', 'One winter month.'],
            ['Over-forecast', 'Largest above ~16 GW. Curtailment is likely, but unconfirmed in scope.'],
            ['Coverage', 'No embedded (distribution-connected) wind.'],
            ['Money', 'No prices or demand: errors are in MW, not £.'],
          ]}
        />
        <Sheet
          title="Source"
          rows={[
            [
              'Code',
              <a key="code" href={REPO_URL} className={link}>
                {REPO_URL.replace('https://', '')}
              </a>,
            ],
            [
              'API',
              <a key="api" href="/api/docs" className={link}>
                Interactive API docs
              </a>,
            ],
          ]}
        />
      </Chapter>
    </>
  )
}
