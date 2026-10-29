import { useState } from 'react'

import { useMeta } from '../api/hooks'
import { isHHMM, toHHMM } from '../lib/time'
import { useCutoff } from '../lib/useCutoff'
import { fieldClass, InfoTip, SegmentedControl } from './ui'

const CUSTOM = 'custom'

/** Decision time on the day before: the auction gates as presets, or any custom time. */
export function CutoffPicker() {
  const meta = useMeta()
  const [cutoff, setCutoff] = useCutoff()
  const [customOpen, setCustomOpen] = useState(false)
  const presets = meta.data?.cutoff_presets ?? []
  const isPreset = presets.some((p) => toHHMM(p.time) === cutoff)
  const custom = customOpen || (presets.length > 0 && !isPreset)

  const options = [
    ...presets.map((p) => ({ value: toHHMM(p.time), label: `${p.label.split(' ')[0]} ${toHHMM(p.time)}`, title: p.note })),
    { value: CUSTOM, label: 'Custom' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-control hidden items-center text-ink-2 md:inline-flex">
        Decide at
        <InfoTip text="The newest forecast published by this time, the day before, is used." />
      </span>
      <SegmentedControl
        label="Decision time on the day before"
        options={options}
        value={custom ? CUSTOM : cutoff}
        onChange={(value) => {
          setCustomOpen(value === CUSTOM)
          if (value !== CUSTOM) setCutoff(value)
        }}
      />
      {custom && (
        <input
          type="time"
          aria-label="Custom decision time, UK"
          value={cutoff}
          step={600}
          onChange={(event) => isHHMM(event.target.value) && setCutoff(event.target.value)}
          className={fieldClass}
        />
      )}
    </div>
  )
}
