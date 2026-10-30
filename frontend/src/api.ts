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

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

export function fetchCountries(): Promise<Country[]> {
  return getJson('/api/countries')
}

export function fetchFlows(minValue: number): Promise<Flow[]> {
  return getJson(`/api/flows?min_value=${minValue}`)
}
