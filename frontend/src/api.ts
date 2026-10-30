export interface Country {
  iso3: string
  name: string
  lat: number
  lon: number
}

export interface Flow {
  year0: number
  orig: string
  dest: string
  value: number // people per 5-year period
}

// Static hosting (GitHub Pages) has no API: read the files from pipeline/export_static.py instead.
// Set in .env.production; local development uses the API.
const STATIC_DATA = import.meta.env.VITE_STATIC_DATA === 'true'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

export function fetchCountries(): Promise<Country[]> {
  return getJson(STATIC_DATA ? `${import.meta.env.BASE_URL}data/countries.json` : '/api/countries')
}

/** In static mode the file always holds flows above 1,000 (see export_static.py). */
export function fetchFlows(minValue: number): Promise<Flow[]> {
  return getJson(STATIC_DATA ? `${import.meta.env.BASE_URL}data/flows.json` : `/api/flows?min_value=${minValue}`)
}
