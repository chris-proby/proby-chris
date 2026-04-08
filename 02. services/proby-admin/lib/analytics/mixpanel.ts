'use client'

import mixpanel from 'mixpanel-browser'

let initialized = false

function token(): string {
  return process.env.NEXT_PUBLIC_MIXPANEL_TOKEN?.trim() ?? ''
}

/** Returns whether Mixpanel is active (token set + init ran). */
export function initMixpanel(): boolean {
  if (typeof window === 'undefined') return false
  if (initialized) return true
  const t = token()
  if (!t) return false
  mixpanel.init(t, {
    persistence: 'localStorage',
    track_pageview: false,
    autocapture: false,
  })
  initialized = true
  return true
}

export function trackMixpanel(event: string, props?: Record<string, unknown>): void {
  if (!initMixpanel()) return
  mixpanel.track(event, props)
}

export function identifyMixpanel(distinctId: string, peopleProps?: Record<string, unknown>): void {
  if (!initMixpanel()) return
  mixpanel.identify(distinctId)
  if (peopleProps && Object.keys(peopleProps).length > 0) {
    const cleaned = Object.fromEntries(
      Object.entries(peopleProps).filter(([, v]) => v !== undefined && v !== null),
    )
    if (Object.keys(cleaned).length > 0) mixpanel.people.set(cleaned)
  }
}

export function registerMixpanelSuper(props: Record<string, unknown>): void {
  if (!initMixpanel()) return
  mixpanel.register(props)
}

export function resetMixpanel(): void {
  if (typeof window === 'undefined' || !initialized) return
  mixpanel.reset()
}
