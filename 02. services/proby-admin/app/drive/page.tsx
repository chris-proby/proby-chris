import { createClient } from '@/lib/supabase/server'
import DriveView from '@/components/drive/DriveView'
import { Folder, FileRecord, Company } from '@/lib/types'

export default async function DrivePage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const { folder: folderId } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileResult = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
  const profile = profileResult.data as { company_id: string | null } | null

  if (!profile?.company_id) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400">아직 회사에 배정되지 않았습니다.</p>
          <p className="text-zinc-600 text-sm mt-1">Proby 팀에 문의해주세요.</p>
        </div>
      </div>
    )
  }

  const { data: companyData } = await supabase.from('companies').select('*').eq('id', profile.company_id).single()
  const company = companyData as Company | null

  const foldersQuery = supabase.from('folders').select('*').eq('company_id', profile.company_id).order('name')
  const { data: allFoldersData } = folderId ? await foldersQuery.eq('parent_id', folderId) : await foldersQuery.is('parent_id', null)

  // Filter folders based on permissions:
  // No permission entries → visible to everyone; has entries → only listed users
  const folderIds = (allFoldersData ?? []).map((f: { id: string }) => f.id)
  const { data: permsData } = folderIds.length > 0
    ? await supabase.from('folder_permissions').select('folder_id, profile_id').in('folder_id', folderIds)
    : { data: [] }

  const allowedByFolder = new Map<string, Set<string>>()
  for (const perm of (permsData ?? [])) {
    const p = perm as { folder_id: string; profile_id: string }
    if (!allowedByFolder.has(p.folder_id)) allowedByFolder.set(p.folder_id, new Set())
    allowedByFolder.get(p.folder_id)!.add(p.profile_id)
  }

  const foldersData = (allFoldersData ?? []).filter((folder: { id: string }) => {
    const allowed = allowedByFolder.get(folder.id)
    if (!allowed) return true
    return allowed.has(user.id)
  })

  const filesQuery = supabase.from('files').select('*').eq('company_id', profile.company_id).order('created_at', { ascending: false })
  const { data: filesData } = folderId ? await filesQuery.eq('folder_id', folderId) : await filesQuery.is('folder_id', null)

  let breadcrumbs: { id: string; name: string }[] = []
  if (folderId) {
    let currentId: string | null = folderId
    while (currentId) {
      const { data: fd } = await supabase.from('folders').select('id, name, parent_id').eq('id', currentId).single()
      if (!fd) break
      const f = fd as { id: string; name: string; parent_id: string | null }
      breadcrumbs.unshift({ id: f.id, name: f.name })
      currentId = f.parent_id
    }
  }

  return (
    <DriveView
      folders={foldersData as Folder[] ?? []}
      files={filesData as FileRecord[] ?? []}
      breadcrumbs={breadcrumbs}
      currentFolderId={folderId ?? null}
      companyId={profile.company_id}
      primaryColor={company?.primary_color ?? '#6366f1'}
      secondaryColor={company?.secondary_color ?? '#8b5cf6'}
    />
  )
}
