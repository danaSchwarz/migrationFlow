import type { Country, Flow } from './api'

interface Props {
  country: Country
  period: number
  flows: Flow[]
  names: Map<string, string>
  onClose: () => void
}

const TOP = 5
const format = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

function FlowList({ title, rows, names }: { title: string; rows: { iso3: string; value: number }[]; names: Map<string, string> }) {
  return (
    <section>
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">No large flows</p>
      ) : (
        <ol>
          {rows.map((row) => (
            <li key={row.iso3}>
              <span>{names.get(row.iso3) ?? row.iso3}</span>
              <span className="value">{format.format(row.value / 5)}/yr</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export function CountryPanel({ country, period, flows, names, onClose }: Props) {
  const inPeriod = flows.filter((f) => f.year0 === period)
  const outgoing = inPeriod
    .filter((f) => f.orig === country.iso3)
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP)
    .map((f) => ({ iso3: f.dest, value: f.value }))
  const incoming = inPeriod
    .filter((f) => f.dest === country.iso3)
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP)
    .map((f) => ({ iso3: f.orig, value: f.value }))

  return (
    <aside className="panel">
      <header>
        <div>
          <h2>{country.name}</h2>
          <p className="muted">
            {period}–{period + 5}, average per year
          </p>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <FlowList title="Moved away to" rows={outgoing} names={names} />
      <FlowList title="Arrived from" rows={incoming} names={names} />
    </aside>
  )
}
