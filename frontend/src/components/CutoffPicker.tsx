import { useMeta } from '../api/hooks'
import { isHHMM, toHHMM } from '../lib/time'
import { useCutoff } from '../lib/useCutoff'
import { InfoTip, inputClass } from './ui'

export function CutoffPicker() {
  const meta = useMeta()
  const [cutoff, setCutoff] = useCutoff()
  const presets = meta.data?.cutoff_presets ?? []

  return (
    <div className="relative">
      <div className="mb-1 flex items-center text-xs font-medium text-ink-2">
        Decision time (day before)
        <InfoTip text="When you commit to the day-ahead purchase on the day before delivery. The app uses the latest wind forecast published at or before this time. Presets are the GB day-ahead auction gate closures; the EPEX time is approximate." />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Auction presets" className="inline-flex rounded-lg border border-line p-0.5">
          {presets.map((preset) => {
            const time = toHHMM(preset.time)
            const active = time === cutoff
            return (
              <button
                key={preset.time}
                type="button"
                title={preset.note}
                aria-pressed={active}
                onClick={() => setCutoff(time)}
                className={`rounded-md px-2.5 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-forecast ${
                  active ? 'bg-forecast text-white' : 'text-ink-2 hover:bg-wash hover:text-ink'
                }`}
              >
                {preset.label.split(' ')[0]} {time}
              </button>
            )
          })}
        </div>
        <label className="inline-flex items-center gap-1.5 text-sm text-ink-2">
          <span className="sr-only">Custom decision time</span>
          or
          <input
            type="time"
            value={cutoff}
            step={600}
            onChange={(event) => isHHMM(event.target.value) && setCutoff(event.target.value)}
            className={inputClass}
          />
          <span className="text-xs text-muted">UK</span>
        </label>
      </div>
    </div>
  )
}
