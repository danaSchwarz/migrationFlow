export type LonLat = [number, number]
export type Position = [number, number, number] // lon, lat, altitude in meters

const EARTH_RADIUS = 6_371_000
const BASE_ALTITUDE = 20_000 // keeps streams clear of the land polygons
const ARC_HEIGHT = 0.08 // peak height as a share of the route length

type Vec3 = [number, number, number]

function toVec([lon, lat]: LonLat): Vec3 {
  const λ = (lon * Math.PI) / 180
  const φ = (lat * Math.PI) / 180
  return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)]
}

function toLonLat([x, y, z]: Vec3): LonLat {
  return [(Math.atan2(y, x) * 180) / Math.PI, (Math.asin(Math.max(-1, Math.min(1, z))) * 180) / Math.PI]
}

/**
 * Shapes crossing the antimeridian (Fiji, Russia) jump from 180 to -180. deck.gl would draw
 * that edge the long way around the globe, so shift longitudes to keep each step under 180°.
 * Changes the ring in place.
 */
export function unwrapLongitudes(ring: number[][]): void {
  for (let i = 1; i < ring.length; i++) {
    while (ring[i][0] - ring[i - 1][0] > 180) ring[i][0] -= 360
    while (ring[i][0] - ring[i - 1][0] < -180) ring[i][0] += 360
  }
}

/** Angle between two points on the sphere, in radians (0 … π). */
export function angularDistance(a: LonLat, b: LonLat): number {
  const [ax, ay, az] = toVec(a)
  const [bx, by, bz] = toVec(b)
  return Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz)))
}

/**
 * Points along the shortest route over the globe, lifted into a low arc.
 * Longitudes are unwrapped (may go past ±180) so no segment jumps across the antimeridian.
 */
export function greatCircleArc(from: LonLat, to: LonLat): Position[] {
  const ω = angularDistance(from, to)
  const segments = Math.max(6, Math.ceil(ω / (Math.PI / 48)))
  const a = toVec(from)
  const b = toVec(to)
  const sinω = Math.sin(ω)
  const peak = ω * EARTH_RADIUS * ARC_HEIGHT

  const path: Position[] = []
  let previousLon = from[0]
  for (let i = 0; i <= segments; i++) {
    const s = i / segments
    const [wa, wb] = sinω < 1e-6 ? [1 - s, s] : [Math.sin((1 - s) * ω) / sinω, Math.sin(s * ω) / sinω]
    const [rawLon, lat] = toLonLat([wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2]])
    let lon = rawLon
    while (lon - previousLon > 180) lon -= 360
    while (lon - previousLon < -180) lon += 360
    previousLon = lon
    path.push([lon, lat, BASE_ALTITUDE + Math.sin(Math.PI * s) * peak])
  }
  return path
}
