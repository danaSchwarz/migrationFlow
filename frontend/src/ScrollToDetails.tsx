import { useEffect, useState } from 'react'

const PANEL_ID = 'country-panel'

/**
 * Phones only: the country details sit below the globe, out of sight.
 * This arrow button scrolls down to them and hides while they are on screen.
 */
export function ScrollToDetails() {
  const [panelVisible, setPanelVisible] = useState(false)

  useEffect(() => {
    const panel = document.getElementById(PANEL_ID)
    if (!panel) return
    // "Visible" = almost all of it on screen, above the fixed speed bar (bottom 70px)
    const observer = new IntersectionObserver(([entry]) => setPanelVisible(entry.intersectionRatio >= 0.9), {
      threshold: [0, 0.9],
      rootMargin: '0px 0px -70px 0px',
    })
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])

  if (panelVisible) return null

  return (
    <button
      className="icon-button scroll-to-details"
      onClick={() => document.getElementById(PANEL_ID)?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
      aria-label="Show country details"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 5v14M6 13l6 6 6-6" />
      </svg>
    </button>
  )
}
