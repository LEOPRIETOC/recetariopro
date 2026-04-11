import { useState, useMemo } from 'react'

export function useTableSort(data, defaultField = null, defaultDir = 'asc') {
  const [sortField, setSortField] = useState(defaultField)
  const [sortDir, setSortDir] = useState(defaultDir)

  const sorted = useMemo(() => {
    if (!sortField) return data
    return [...data].sort((a, b) => {
      const aV = a[sortField] ?? ''
      const bV = b[sortField] ?? ''
      const cmp = typeof aV === 'number' && typeof bV === 'number'
        ? aV - bV
        : String(aV).localeCompare(String(bV))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortField, sortDir])

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span style={{ color: 'var(--t3)', marginLeft: 4, opacity: 0.4 }}>⇅</span>
    return <span style={{ color: 'var(--accent)', marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return { sorted, toggleSort, SortIcon, sortField, sortDir }
}
