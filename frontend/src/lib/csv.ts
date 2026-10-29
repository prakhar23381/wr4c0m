type Cell = string | number | null | undefined

export function toCsv(header: string[], rows: Cell[][]): string {
  const escape = (cell: Cell) => {
    const text = cell == null ? '' : String(cell)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [header, ...rows].map((row) => row.map(escape).join(',')).join('\n') + '\n'
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  link.click()
  URL.revokeObjectURL(url)
}
