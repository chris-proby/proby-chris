import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Company, Folder, FileRecord } from '@/lib/types'
import AdminDriveView from '@/components/admin/AdminDriveView'

export default async function AdminCompanyDrivePage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>
  searchParams: Promise<{ folder?: string }>
}) {
  const { companyId } = await params
  const { folder: folderId } = await searchParams
  const supabase = await createClient()

  const { data: companyData } = await supabase.from('companies').select('*').eq('id', companyId).single()
  if (!companyData) notFound()
  const company = companyData as Company

  const foldersQuery = supabase.from('folders').select('*').eq('company_id', companyId).order('name')
  const { data: foldersData } = folderId ? await foldersQuery.eq('parent_id', folderId) : await foldersQuery.is('parent_id', null)

  const filesQuery = supabase.from('files').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
  const { data: filesData } = folderId ? await filesQuery.eq('folder_id', folderId) : await filesQuery.is('folder_id', null)

  const folderIds = (foldersData ?? []).map((f: { id: string }) => f.id)
  const { data: permsData } = folderIds.length > 0
    ? await supabase.from('folder_permissions').select('folder_id').in('folder_id', folderIds)
    : { data: [] }
  const restrictedFolderIds = new Set((permsData ?? []).map((p: { folder_id: string }) => p.folder_id))

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

  const hrefBase = `/admin/${companyId}/drive`

  return (
    <AdminDriveView
      company={company}
      folders={foldersData as Folder[] ?? []}
      files={filesData as FileRecord[] ?? []}
      breadcrumbs={breadcrumbs}
      currentFolderId={folderId ?? null}
      restrictedFolderIds={restrictedFolderIds}
      hrefBase={hrefBase}
    />
  )
}
