import { useRef } from 'react'
import { END_YEAR, PERIODS, START_YEAR } from './time'

interface Props {
  year: number
  centerX: number
  centerY: number
  radius: number
  onScrubStart: () => void
  onScrub: (year: number) => void
  onScrubEnd: () => void
}

const SPAN = END_YEAR - START_YEAR

/**
 * Fraction of the loop -> point on the ring.
 * The seam (1990/2020) is at the top; time runs counterclockwise.
 */
function pointAt(fraction: number, cx: number, cy: number, r: number): [number, number] {
  const angle = fraction * 2 * Math.PI
  return [cx - r * Math.sin(angle), cy - r * Math.cos(angle)]
}

export function TimeRing({ year, centerX: cx, centerY: cy, radius: r, onScrubStart, onScrub, onScrubEnd }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const fraction = (year - START_YEAR) / SPAN
  const [knobX, knobY] = pointAt(fraction, cx, cy, r)
  const [topX, topY] = pointAt(0, cx, cy, r)

  function yearFromPointer(event: React.PointerEvent): number {
    const rect = svgRef.current!.getBoundingClientRect()
    const dx = event.clientX - rect.left - cx
    const dy = event.clientY - rect.top - cy
    const f = (Math.atan2(-dx, -dy) / (2 * Math.PI) + 1) % 1
    return START_YEAR + f * SPAN
  }

  function handleDown(event: React.PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId)
    onScrubStart()
    onScrub(yearFromPointer(event))
  }

  function handleMove(event: React.PointerEvent) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) onScrub(yearFromPointer(event))
  }

  function handleUp(event: React.PointerEvent) {
    event.currentTarget.releasePointerCapture(event.pointerId)
    onScrubEnd()
  }

  const yearTicks = Array.from({ length: SPAN }, (_, i) => START_YEAR + i)

  return (
    <svg ref={svgRef} className="time-ring" width="100%" height="100%">
      <circle className="ring-track" cx={cx} cy={cy} r={r} />
      {fraction > 0.001 && (
        <path
          className="ring-progress"
          d={`M ${topX} ${topY} A ${r} ${r} 0 ${fraction > 0.5 ? 1 : 0} 0 ${knobX} ${knobY}`}
        />
      )}

      {yearTicks.map((y) => {
        const major = PERIODS.includes(y)
        const [x1, y1] = pointAt((y - START_YEAR) / SPAN, cx, cy, r - (major ? 9 : 5))
        const [x2, y2] = pointAt((y - START_YEAR) / SPAN, cx, cy, r + (major ? 9 : 5))
        return <line key={y} className={major ? 'tick major' : 'tick'} x1={x1} y1={y1} x2={x2} y2={y2} />
      })}

      {PERIODS.slice(1).map((y) => {
        const [x, ty] = pointAt((y - START_YEAR) / SPAN, cx, cy, r + 24)
        return (
          <text key={y} className="tick-label" x={x} y={ty}>
            {y}
          </text>
        )
      })}

      {/* The seam where the loop ends and starts again */}
      <line className="seam" x1={cx} y1={cy - r - 14} x2={cx} y2={cy - r + 14} />
      <text className="tick-label seam-label" x={cx} y={cy - r - 26}>
        1990 | 2020
      </text>

      {/* Wide invisible stroke: the touch target for scrubbing */}
      <circle
        className="ring-hit"
        cx={cx}
        cy={cy}
        r={r}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      />
      <circle className="ring-knob" cx={knobX} cy={knobY} r={9} />
    </svg>
  )
}
