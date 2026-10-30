import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { _GlobeView as GlobeView, type PickingInfo } from '@deck.gl/core'
import { GeoJsonLayer, ScatterplotLayer, SolidPolygonLayer } from '@deck.gl/layers'
import { TripsLayer } from '@deck.gl/geo-layers'
import { geoContains, geoDistance } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Polygon } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import worldTopology from 'world-atlas/countries-110m.json'

import { fetchCountries, fetchFlows, type Country, type Flow } from './api'
import { AboutDialog } from './AboutDialog'
import { CountryPanel } from './CountryPanel'
import { unwrapLongitudes, type LonLat } from './geo'
import { buildParticles, CYCLE_MS, TRAIL_MS, type Particle } from './streams'
import { loopFade, PERIODS, periodOf, periodWeights, START_YEAR, wrapYear } from './time'
import { TimeRing } from './TimeRing'
import './App.css'

// Phones only (same breakpoint as App.css); tablets get the desktop experience
const IS_MOBILE = window.matchMedia('(max-width: 600px)').matches
const MOBILE_HEADER = 72 // px above the globe on phones, for the year (must match --header in App.css)
const STREAM_SETTINGS = IS_MOBILE ? { maxFlows: 250, maxParticles: 6 } : { maxFlows: 800, maxParticles: 10 }
const MIN_FLOW = 1000 // people per 5 years; smaller flows aren't fetched at all
const SECONDS_PER_YEAR = 1.5
const SPEEDS = [0.5, 1, 2, 4]
// Serbia and Montenegro, Sudan incl. South Sudan: same spot as Serbia and Sudan, not small
const HISTORIC = new Set(['SCG', 'SUD'])
const RING_ZOOM = 4 // tiny countries get their ring only when zoomed in this far

const STREAM_COLOR: [number, number, number] = [255, 186, 90]
const VIEW = new GlobeView({ resolution: 5 })
// Ocean as a grid of small cells: one huge polygon gets triangles that cut through the globe
const OCEAN_CELL = 10
const OCEAN = Array.from({ length: (360 / OCEAN_CELL) * (180 / OCEAN_CELL) }, (_, i) => {
  const lon = -180 + (i % (360 / OCEAN_CELL)) * OCEAN_CELL
  const lat = -90 + Math.floor(i / (360 / OCEAN_CELL)) * OCEAN_CELL
  return [[lon, lat], [lon + OCEAN_CELL, lat], [lon + OCEAN_CELL, lat + OCEAN_CELL], [lon, lat + OCEAN_CELL]]
})
const topology = worldTopology as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>
const LAND = feature(topology, topology.objects.countries)
for (const country of LAND.features) {
  const { geometry } = country
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  polygons.forEach((rings) => rings.forEach(unwrapLongitudes))
}
type LandShape = (typeof LAND.features)[number]

/**
 * The map shapes have no ISO3 codes, so link them through our label points, which always lie
 * inside their country. One shape can hold several points: Italy's holds San Marino,
 * France's holds Monaco and French Guiana. The shape's owner is the country with the same name.
 */
interface ShapeCountries {
  owner: Country | null
  all: Country[]
  parts: { polygon: Polygon; countries: Country[] }[] // islands, exclaves, overseas pieces
}

function matchShape(shape: LandShape, countries: Country[]): ShapeCountries {
  const { geometry } = shape
  const polygons: Polygon[] =
    geometry.type === 'Polygon'
      ? [geometry]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }))
        : []
  const all = countries.filter((c) => geoContains(shape, [c.lon, c.lat]))
  const name = shape.properties?.name
  const owner =
    all.find((c) => c.name === name) ??
    // The coarse map can miss a label point (New Zealand's lies just outside its outline)
    countries.find((c) => c.name === name) ??
    (all.length === 1 ? all[0] : null)
  const parts = polygons.map((polygon) => ({
    polygon,
    countries: all.filter((c) => geoContains(polygon, [c.lon, c.lat])),
  }))
  return { owner, all, parts }
}

/** Tapped piece holds the owner (or nothing, like Sardinia) -> owner; else the nearest point in that piece. */
function countryAt(shape: ShapeCountries, tap: LonLat): Country | null {
  const part = shape.parts.find((p) => geoContains(p.polygon, tap))
  const inPart = part?.countries ?? []
  if (shape.owner && (inPart.length === 0 || inPart.includes(shape.owner))) return shape.owner
  return nearest(inPart.length > 0 ? inPart : shape.all, tap)
}

function nearest(countries: Country[], [lon, lat]: LonLat): Country | null {
  let best: Country | null = null
  let bestDistance = Infinity
  for (const c of countries) {
    const distance = geoDistance([c.lon, c.lat], [lon, lat])
    if (distance < bestDistance) {
      best = c
      bestDistance = distance
    }
  }
  return best
}

/** Ring sits a little inside the screen edge; leaves room for its labels. */
function ringRadius(width: number, height: number) {
  return Math.max(Math.min(width, height) / 2 - 48, 60)
}

/**
 * Zoom at which the globe's outline has the given radius on screen.
 * deck.gl's camera sits 1.5 × the screen height in front of the globe's surface, so perspective
 * shrinks the globe: work back from the visible radius to the radius at the focal plane,
 * then convert that to a zoom level (see deck.gl's GlobeViewport).
 */
function fittingZoom(visibleRadiusPx: number, screenHeight: number, latitude: number) {
  const cameraDistance = 1.5 * screenHeight
  const t = visibleRadiusPx / cameraDistance
  const sinAngle = t / Math.sqrt(1 + t * t) // angular radius of the globe, seen from the camera
  const radiusPx = (sinAngle * cameraDistance) / (1 - sinAngle)
  return Math.log2((radiusPx * Math.PI * Math.cos((latitude * Math.PI) / 180)) / 256)
}

function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

export default function App() {
  const { width, height } = useWindowSize()
  const [countries, setCountries] = useState<Country[]>([])
  const [flows, setFlows] = useState<Flow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Country | null>(null)

  // Time: `year` is the position in the loop, `clock` drives the particles (always forward)
  const [year, setYear] = useState(START_YEAR)
  const [clock, setClock] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const playingRef = useRef(playing)
  const speedRef = useRef(speed)
  const scrubbingRef = useRef(false)
  playingRef.current = playing
  speedRef.current = speed

  useEffect(() => {
    Promise.all([fetchCountries(), fetchFlows(MIN_FLOW)])
      .then(([c, f]) => {
        setCountries(c)
        setFlows(f)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) // don't jump after the tab was in the background
      last = now
      setClock((c) => (c + dt) % CYCLE_MS)
      if (playingRef.current && !scrubbingRef.current) {
        setYear((y) => wrapYear(y + (dt / 1000 / SECONDS_PER_YEAR) * speedRef.current))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const names = useMemo(() => new Map(countries.map((c) => [c.iso3, c.name])), [countries])

  const countriesByShape = useMemo(
    () => new Map(LAND.features.map((shape) => [shape, matchShape(shape, countries)])),
    [countries],
  )

  // Countries you can't select by tapping the map (microstates, small islands):
  // when zoomed in, they get a tappable ring instead
  const tinyCountries = useMemo(() => {
    const reachable = new Set<string>()
    for (const shape of countriesByShape.values()) {
      if (shape.owner) reachable.add(shape.owner.iso3)
      for (const c of shape.all) {
        if (countryAt(shape, [c.lon, c.lat]) === c) reachable.add(c.iso3)
      }
    }
    return countries.filter((c) => !reachable.has(c.iso3) && !HISTORIC.has(c.iso3))
  }, [countries, countriesByShape])
  const [zoomedIn, setZoomedIn] = useState(false)

  function handleClick(info: PickingInfo) {
    let clicked: Country | null = null
    if (info.layer?.id === 'tiny-countries') {
      clicked = info.object as Country
    } else if (info.layer?.id === 'land' && info.coordinate) {
      const shape = countriesByShape.get(info.object as LandShape)
      clicked = shape ? countryAt(shape, [info.coordinate[0], info.coordinate[1]]) : null
    }
    // Clicking the selected country again unselects it
    setSelected(clicked?.iso3 === selected?.iso3 ? null : clicked)
  }

  // One particle set per 5-year period. With a country selected, only its own flows are drawn
  // (all of them, not just the world's biggest), scaled to that country's largest flow.
  const particlesByPeriod = useMemo(() => {
    const coordinates = new Map<string, LonLat>(countries.map((c) => [c.iso3, [c.lon, c.lat]]))
    const shown = selected ? flows.filter((f) => f.orig === selected.iso3 || f.dest === selected.iso3) : flows
    const max = shown.reduce((m, f) => Math.max(m, f.value), 1)
    return new Map<number, Particle[]>(
      PERIODS.map((p) => [
        p,
        buildParticles(
          shown.filter((f) => f.year0 === p),
          coordinates,
          max,
          STREAM_SETTINGS,
        ),
      ]),
    )
  }, [countries, flows, selected])

  const radius = ringRadius(width, height)
  // On phones the globe canvas is a square around the ring, so the strips above and below it can scroll the page
  const canvasHeight = IS_MOBILE ? Math.min(width, height) : height
  // Phones: globe right under the year. Desktop: centered on the screen.
  const centerY = IS_MOBILE ? MOBILE_HEADER + canvasHeight / 2 : height / 2
  const hasSize = width > 0 && height > 0
  const initialViewState = useMemo(
    () => ({ longitude: 15, latitude: 20, zoom: fittingZoom(radius - 10, canvasHeight, 20), minZoom: -1, maxZoom: 6 }),
    // Only once the window has a size: later resizes shouldn't reset the user's rotation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasSize],
  )

  const weights = periodWeights(year)
  const fade = loopFade(year)

  const layers = [
    new SolidPolygonLayer({
      id: 'ocean',
      data: OCEAN,
      getPolygon: (d) => d,
      getFillColor: [14, 22, 38],
    }),
    new GeoJsonLayer({
      id: 'land',
      data: LAND,
      pickable: true,
      filled: true,
      stroked: true,
      getFillColor: (shape) =>
        // Only the selected country's own shape: San Marino's point lies inside Italy's
        selected && countriesByShape.get(shape as LandShape)?.owner?.iso3 === selected.iso3 ? [58, 76, 102] : [36, 48, 66],
      updateTriggers: { getFillColor: selected?.iso3 },
      getLineColor: [70, 86, 110],
      lineWidthMinPixels: 0.5,
    }),
    ...PERIODS.map((p) => {
      const opacity = (weights.get(p) ?? 0) * fade
      return new TripsLayer<Particle>({
        id: `streams-${p}`,
        data: particlesByPeriod.get(p),
        visible: opacity > 0.01,
        opacity,
        getPath: (d) => d.path,
        getTimestamps: (d) => d.timestamps,
        getColor: STREAM_COLOR,
        widthMinPixels: IS_MOBILE ? 1.5 : 2,
        capRounded: true,
        jointRounded: true,
        fadeTrail: true,
        trailLength: TRAIL_MS,
        currentTime: CYCLE_MS + clock,
        // Additive blending: busy corridors glow brighter. Don't write depth, so trails don't hide each other.
        parameters: {
          depthWriteEnabled: false,
          blend: true,
          blendColorSrcFactor: 'src-alpha',
          blendColorDstFactor: 'one',
          blendAlphaSrcFactor: 'one',
          blendAlphaDstFactor: 'one',
        },
      })
    }),
    new ScatterplotLayer<Country>({
      id: 'tiny-countries',
      data: tinyCountries,
      visible: zoomedIn,
      pickable: true,
      getPosition: (d) => [d.lon, d.lat],
      radiusUnits: 'pixels',
      getRadius: 5,
      stroked: true,
      lineWidthUnits: 'pixels',
      getLineWidth: 1.5,
      getLineColor: [200, 215, 235, 220],
      getFillColor: (d) => (d.iso3 === selected?.iso3 ? [255, 255, 255] : [58, 76, 102, 230]),
      updateTriggers: { getFillColor: selected?.iso3 },
    }),
  ]

  const onScrubStart = useCallback(() => (scrubbingRef.current = true), [])
  const onScrubEnd = useCallback(() => (scrubbingRef.current = false), [])
  const onScrub = useCallback((y: number) => setYear(wrapYear(y)), [])

  const period = periodOf(year)

  return (
    <div className="app">
      {/* One screen high; on phones the country panel follows below it and the page scrolls */}
      <div className="stage">
        <div className="globe">
          <DeckGL
            views={VIEW}
            initialViewState={initialViewState}
            onViewStateChange={({ viewState }) => {
              setZoomedIn(viewState.zoom >= RING_ZOOM)
            }}
            controller={true}
            layers={layers}
            pickingRadius={12}
            onClick={handleClick}
            getCursor={({ isHovering, isDragging }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab')}
          />
        </div>

        <TimeRing
          year={year}
          centerX={width / 2}
          centerY={centerY}
          radius={radius}
          onScrubStart={onScrubStart}
          onScrub={onScrub}
          onScrubEnd={onScrubEnd}
        />

        <div className="year">
          <div className="year-value">{Math.floor(year)}</div>
          <div className="year-period">
            estimates for {period}–{period + 5}
          </div>
        </div>

        {error && <div className="status error">Could not load data: {error}</div>}
        {!error && flows.length === 0 && <div className="status">Loading flows…</div>}

        {/* Also holds the data credits (CC BY 4.0) */}
        <AboutDialog />
      </div>

      <div className="controls">
        <button className="icon-button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : '▶'}
        </button>
        {SPEEDS.map((s) => (
          <button key={s} className={s === speed ? 'speed active' : 'speed'} onClick={() => setSpeed(s)}>
            {s}×
          </button>
        ))}
      </div>

      {selected && (
        <CountryPanel country={selected} period={period} flows={flows} names={names} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
