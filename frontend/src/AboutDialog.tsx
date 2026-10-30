import { useRef } from 'react'

function BookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2Z" />
      <path d="M12 6.5v13" />
    </svg>
  )
}

/** Book button (bottom right) that opens a dialog about the data and the app. */
export function AboutDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button className="icon-button about-button" onClick={() => dialogRef.current?.showModal()} aria-label="About this map">
        <BookIcon />
      </button>

      <dialog
        ref={dialogRef}
        className="about-dialog"
        // A click on the backdrop lands on the dialog element itself
        onClick={(event) => event.target === dialogRef.current && dialogRef.current.close()}
      >
        <header>
          <h2>About this map</h2>
          <button className="icon-button" onClick={() => dialogRef.current?.close()} aria-label="Close">
            ✕
          </button>
        </header>

        <section>
          <h3>What you see</h3>
          <p>
            Each stream is people moving from one country to another, from 1990 to 2020. Particles always flow from
            origin to destination; more particles mean more people. All migration is drawn the same way, whatever the
            reason for moving.
          </p>
        </section>

        <section>
          <h3>How to use it</h3>
          <ul>
            <li>Drag to rotate the globe, scroll or pinch to zoom.</li>
            <li>
              The ring around the globe is time. It runs counterclockwise; drag it to jump to a year. The dashed line
              at the top is where 2020 loops back to 1990.
            </li>
            <li>Tap a country to see only its migration and its largest flows. Tap it again to go back.</li>
            <li>Zoom in closely to see rings for very small countries and islands.</li>
          </ul>
        </section>

        <section>
          <h3>The data</h3>
          <p>
            Migration flows are estimates by Guy Abel and Joel Cohen (version 8, 2025), based on the UN's
            International Migrant Stock 2024. They come in 5-year periods; the map blends between periods and shows
            yearly averages. The estimates are minimums: people who moved and came back within the same period are
            not counted.
          </p>
          <p>
            To keep the map readable, it shows flows of at least 1,000 people per period, and only the largest flows of
            each period.
          </p>
          <ul className="sources">
            <li>
              <a href="https://figshare.com/articles/dataset/Bilateral_international_migration_flow_estimates_for_200_countries_1990-1995_to_2010-2015_/7731233" target="_blank" rel="noreferrer">
                Abel &amp; Cohen, bilateral international migration flow estimates
              </a>{' '}
              (CC BY 4.0)
            </li>
            <li>
              <a href="https://doi.org/10.1038/s41597-019-0089-3" target="_blank" rel="noreferrer">
                Abel &amp; Cohen (2019), Scientific Data
              </a>{' '}
              – how the estimates are made
            </li>
            <li>
              <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">
                Natural Earth
              </a>{' '}
              – country shapes and positions (public domain)
            </li>
          </ul>
        </section>
      </dialog>
    </>
  )
}
