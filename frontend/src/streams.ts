import type { Flow } from './api'
import { angularDistance, greatCircleArc, type LonLat, type Position } from './geo'

/** One particle travelling from origin to destination, animated by deck.gl's TripsLayer. */
export interface Particle {
  path: Position[]
  timestamps: number[]
}

export interface StreamSettings {
  maxFlows: number // biggest flows drawn per period
  maxParticles: number // particles on the biggest flow of all periods
}

// Animation clock, in milliseconds of real time (independent of the year)
export const CYCLE_MS = 4000 // every particle restarts after this long
export const TRAIL_MS = 600
const MIN_TRAVEL_MS = 1500 // short routes
const MAX_TRAVEL_MS = 3000 // routes halfway around the world
const JITTER_DEGREES = 0.6 // spreads particles of one route into a stream instead of a single line

function jitter([lon, lat]: LonLat): LonLat {
  return [lon + (Math.random() - 0.5) * 2 * JITTER_DEGREES, lat + (Math.random() - 0.5) * 2 * JITTER_DEGREES]
}

/**
 * Turns one period's flows into particles. Particle count grows with the square root of the
 * flow, so big corridors stand out without hiding everything else.
 * `globalMax` is the largest flow across all periods, so periods stay comparable.
 */
export function buildParticles(
  flows: Flow[],
  coordinates: Map<string, LonLat>,
  globalMax: number,
  settings: StreamSettings,
): Particle[] {
  const particles: Particle[] = []
  const biggest = [...flows].sort((a, b) => b.value - a.value).slice(0, settings.maxFlows)

  for (const flow of biggest) {
    const from = coordinates.get(flow.orig)
    const to = coordinates.get(flow.dest)
    if (!from || !to) continue

    const count = Math.max(1, Math.round(settings.maxParticles * Math.sqrt(flow.value / globalMax)))
    const travel = MIN_TRAVEL_MS + (MAX_TRAVEL_MS - MIN_TRAVEL_MS) * (angularDistance(from, to) / Math.PI)

    for (let i = 0; i < count; i++) {
      const path = greatCircleArc(jitter(from), jitter(to))
      const offset = ((i + Math.random() * 0.8) / count) * CYCLE_MS
      // Two copies one cycle apart: the animation time runs from CYCLE_MS to 2 * CYCLE_MS,
      // so particles that started "before" the cycle are still on their way when it wraps.
      for (const start of [offset, offset + CYCLE_MS]) {
        particles.push({
          path,
          timestamps: path.map((_, j) => start + (travel * j) / (path.length - 1)),
        })
      }
    }
  }
  return particles
}
