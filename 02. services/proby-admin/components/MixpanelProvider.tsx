'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { initMixpanel, trackMixpanel } from '@/lib/analytics/mixpanel'

export default function MixpanelProvider() {
  const pathname = usePathname()

  useEffect(() => {
    initMixpanel()
  }, [])

  useEffect(() => {
    trackMixpanel('Page Viewed', { path: pathname })
  }, [pathname])

  return null
}
