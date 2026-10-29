import type { ReactNode } from 'react'

import { useMeta } from '../api/hooks'
import { Card } from '../components/ui'
import { formatDate, formatDayTime, toHHMM } from '../lib/time'

const REPO_URL = 'https://github.com/prakhar23381/wr4c0m'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title}>
      <div className="space-y-3 text-sm leading-relaxed text-ink-2 [&_b]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </Card>
  )
}

export function MethodologyPage() {
  const meta = useMeta().data

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Methodology</h1>
        <p className="mt-1 text-ink-2">How the numbers in this app are produced, and what they can't tell you.</p>
      </div>

      <Section title="The question">
        <p>
          A utility buys power for tomorrow (delivery day <b>D</b>) on the day-ahead market, which closes on the day
          before (<b>D−1</b>). Whatever wind generation it expects but doesn't get has to be bought later, usually at a
          worse price. So the useful questions are: <b>what did the wind forecast say when the purchase had to be
          made</b>, and <b>how much should that forecast be trusted</b>?
        </p>
      </Section>

      <Section title="Data">
        <ul>
          <li>
            <b>Actual wind</b>: Elexon BMRS <code>FUELHH</code>, fuel type <code>WIND</code>. Half-hourly metered output
            of transmission-connected wind farms, in MW.
          </li>
          <li>
            <b>Forecast wind</b>: Elexon BMRS <code>WINDFOR</code>. Hourly values, published about eight times a day.
            Each publish covers a fixed window from 21:00 UTC the previous evening to 21:00 UTC two days later, so a
            forecast for day D is available from early on D−2.
          </li>
          <li>
            <b>Scope</b>: only purchase decisions made in January 2026
            {meta && (
              <>
                {' '}
                ({formatDate(meta.decision_first_day)} to {formatDate(meta.decision_last_day)}), i.e. delivery days{' '}
                {formatDate(meta.delivery_first_day)} to {formatDate(meta.delivery_last_day)}
              </>
            )}
            . No other datasets are used.
          </li>
          <li>
            The data is downloaded once into a versioned snapshot shipped with the app
            {meta && <> (built {formatDayTime(meta.data_built_at)}, {meta.forecast_publishes} forecast publishes)</>}.
            Quality checks for gaps, duplicates, late publishes and implausible values run when it is built.
            {meta && meta.late_publishes.length > 0 && (
              <>
                {' '}
                One forecast was published late ({meta.late_publishes.map((p) => formatDayTime(p)).join(', ')}); it
                counts only from when it actually appeared.
              </>
            )}
          </li>
        </ul>
      </Section>

      <Section title="The decision time">
        <p>
          For each delivery day D, the app uses the <b>latest forecast published at or before the decision time on
          D−1</b>, never one published after it. This avoids look-ahead bias: it shows exactly what a trader could
          have known.
        </p>
        <ul>
          {(meta?.cutoff_presets ?? []).map((preset) => (
            <li key={preset.time}>
              <b>
                {preset.label}, {toHHMM(preset.time)}
              </b>
              : {preset.note}.
            </li>
          ))}
          <li>Any other time can be entered to see how the answer changes with the decision time.</li>
        </ul>
        <p>
          At the default 09:50 cutoff in January (GMT), that is the 09:30 publish, which looks 14.5 to 37.5 hours
          ahead across the delivery day.
        </p>
      </Section>

      <Section title="Matching forecast to actual">
        <p>
          The forecast is hourly and actuals are half-hourly. Each forecast hour is compared with the actual
          half-hour starting on the hour. Averaging both half-hours instead changes the January average miss by under
          1% (1,996 vs 2,013 MW), so the simpler rule is used.
        </p>
      </Section>

      <Section title="Metrics">
        <ul>
          <li>
            <b>Error</b> = actual − forecast. <b>Negative means less wind than forecast</b> (a shortfall).
          </li>
          <li>
            <b>Average miss (MAE)</b>: mean of |error|. <b>RMSE</b>: square root of the mean squared error, which
            weights big misses more.
          </li>
          <li>
            <b>Bias</b>: mean error. It shows a systematic lean, which an average miss alone hides.
          </li>
          <li>
            <b>WAPE</b>: Σ|error| ÷ Σ actual. MAPE is avoided because it explodes in near-calm hours.
          </li>
          <li>
            <b>P10 / P50 / P90</b>: percentiles of hourly errors. <b>Shortfall buffer</b> = −P10: in 9 hours out of 10
            the shortfall was no bigger than this.
          </li>
          <li>
            <b>Accuracy by lead time</b> uses every forecast publish (not only the one at the decision time), to show how
            accuracy changes with horizon.
          </li>
        </ul>
      </Section>

      <Section title="The likely range on the decision view">
        <p>
          Forecast errors grow with the wind level, so one fixed band would be too wide on calm days and too narrow on
          windy ones. For each forecast hour, the band is the forecast plus the <b>P10, P50 and P90 of past errors for
          forecasts at a similar level</b> (4 GW buckets; buckets with fewer than 30 hours fall back to all hours),
          floored at 0 MW.
        </p>
        <p>
          The errors come from the <b>other delivery days</b> in the window: the day on screen is left out, so the band
          is not fitted to the outcome it is shown against. It is still drawn from the same month, so treat it as an
          illustration of how a production band would work, not a validated forecast.
        </p>
      </Section>

      <Section title="Limitations">
        <ul>
          <li>One winter month is a small sample. Seasonal patterns and rare events are not covered.</li>
          <li>
            The forecast is systematically too high, most of all above ~16 GW, where actual output plateaus around
            15–17 GW. <b>Curtailment</b> (wind farms paid to turn down when the grid is constrained) is a likely cause,
            but confirming it needs balancing data outside this app's scope.
          </li>
          <li>Wind on the distribution network (embedded wind) is not in FUELHH, so it is not assessed here.</li>
          <li>There is no price or demand data, so errors are in MW and MWh, not £.</li>
          <li>The EPEX gate time is approximate; the N2EX time is the published gate closure.</li>
        </ul>
      </Section>

      <Section title="Source and API">
        <p>
          Code: <a href={REPO_URL} className="text-forecast underline">{REPO_URL.replace('https://', '')}</a>. Every number
          here comes from a documented REST API: <a href="/api/docs" className="text-forecast underline">interactive API
          docs</a>.
        </p>
      </Section>
    </div>
  )
}
