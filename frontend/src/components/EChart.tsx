import { BarChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  SVGRenderer,
])

export type ChartOption = echarts.EChartsCoreOption
export type ChartClick = (params: { dataIndex: number; seriesName?: string }) => void

interface Props {
  option: ChartOption
  /** Accessible summary of what the chart shows. */
  label: string
  height?: number
  onClick?: ChartClick
}

export function EChart({ option, label, height = 320, onClick }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    const element = container.current
    if (!element) return
    const instance = echarts.init(element, null, { renderer: 'svg' })
    chart.current = instance
    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(element)
    return () => {
      observer.disconnect()
      instance.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true })
  }, [option])

  useEffect(() => {
    const instance = chart.current
    if (!instance || !onClick) return
    const handler = (params: unknown) => onClick(params as Parameters<ChartClick>[0])
    instance.on('click', handler)
    instance.getZr().setCursorStyle('pointer')
    return () => {
      instance.off('click', handler)
    }
  }, [onClick])

  return <div ref={container} role="img" aria-label={label} className="w-full" style={{ height }} />
}
