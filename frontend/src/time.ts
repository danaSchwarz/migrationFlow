export const START_YEAR = 1990
export const END_YEAR = 2020 // end of the last 5-year period (2015–2020)
export const PERIODS = [1990, 1995, 2000, 2005, 2010, 2015]
const PERIOD_LENGTH = 5
const LOOP_FADE_YEARS = 0.6

/** Wraps any year into [START_YEAR, END_YEAR). */
export function wrapYear(year: number): number {
  const span = END_YEAR - START_YEAR
  return START_YEAR + ((((year - START_YEAR) % span) + span) % span)
}

/** The 5-year period a year falls into, e.g. 2003.4 -> 2000. */
export function periodOf(year: number): number {
  const index = Math.floor((year - START_YEAR) / PERIOD_LENGTH)
  return PERIODS[Math.min(Math.max(index, 0), PERIODS.length - 1)]
}

/**
 * How visible each period's streams are at a given year.
 * Each period is fully shown at its midpoint and crossfades into its neighbours,
 * so the map changes smoothly instead of jumping every 5 years.
 */
export function periodWeights(year: number): Map<number, number> {
  const weights = new Map(PERIODS.map((p) => [p, 0]))
  const position = (year - START_YEAR - PERIOD_LENGTH / 2) / PERIOD_LENGTH
  const clamped = Math.min(Math.max(position, 0), PERIODS.length - 1)
  const lower = Math.floor(clamped)
  const upper = Math.min(lower + 1, PERIODS.length - 1)
  const t = clamped - lower
  weights.set(PERIODS[lower], 1 - t)
  if (upper !== lower) weights.set(PERIODS[upper], t)
  return weights
}

/** Fades everything out just before the loop restarts and back in right after. */
export function loopFade(year: number): number {
  return Math.min(1, (year - START_YEAR) / LOOP_FADE_YEARS, (END_YEAR - year) / LOOP_FADE_YEARS)
}
