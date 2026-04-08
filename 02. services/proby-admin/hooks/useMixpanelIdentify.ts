'use client'

import { useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile, Company } from '@/lib/types'
import { identifyMixpanel, registerMixpanelSuper } from '@/lib/analytics/mixpanel'

type Shell = 'DriveLayout' | 'AdminLayout'

export function useMixpanelIdentify(opts: {
  user: User | null
  profile: Profile | null
  company: Company | null
  shell: Shell
  /** true when super admin is viewing a specific company drive (impersonation-style shell). */
  isAdminCompanyShell?: boolean
}) {
  const { user, profile, company, shell, isAdminCompanyShell } = opts

  useEffect(() => {
    if (!user) return
    identifyMixpanel(user.email ?? user.id, {
      $email: user.email ?? undefined,
      email: user.email ?? undefined,
      full_name: profile?.full_name ?? undefined,
      company_id: company?.id ?? profile?.company_id ?? undefined,
      company_name: company?.name ?? undefined,
      is_super_admin: profile?.is_super_admin ?? false,
    })
    registerMixpanelSuper({
      app: 'proby-admin',
      shell,
      ...(isAdminCompanyShell !== undefined && { is_admin_company_shell: isAdminCompanyShell }),
    })
  }, [
    user?.id,
    user?.email,
    profile?.full_name,
    profile?.company_id,
    profile?.is_super_admin,
    company?.id,
    company?.name,
    shell,
    isAdminCompanyShell,
  ])
}
