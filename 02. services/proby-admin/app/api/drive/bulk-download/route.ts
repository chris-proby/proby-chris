import { NextRequest, NextResponse } from 'next/server'
import { downloadZip, type InputWithMeta } from 'client-zip'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 300

type FileRow = {
  id: string
  company_id: string
  storage_bucket: string
  storage_path: string
  original_name: string
  file_size: number | null
  updated_at: string | null
}

export async function POST(request: NextRequest) {
  let body: { fileIds?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }
  const fileIds = Array.isArray(body.fileIds) ? body.fileIds.filter((x): x is string => typeof x === 'string') : []
  if (fileIds.length === 0) return NextResponse.json({ error: 'fileIds required' }, { status: 400 })
  if (fileIds.length > 500) return NextResponse.json({ error: 'too many files (max 500)' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, is_super_admin')
    .eq('id', user.id)
    .single()
  const isSuperAdmin = !!(profile as { is_super_admin: boolean } | null)?.is_super_admin
  const userCompanyId = (profile as { company_id: string | null } | null)?.company_id ?? null

  const { data: files, error: filesError } = await supabase
    .from('files')
    .select('id, company_id, storage_bucket, storage_path, original_name, file_size, updated_at')
    .in('id', fileIds)
  if (filesError) return NextResponse.json({ error: filesError.message }, { status: 500 })
  if (!files || files.length === 0) return NextResponse.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 })

  const rows = files as FileRow[]
  if (!isSuperAdmin) {
    const unauthorized = rows.find((f) => f.company_id !== userCompanyId)
    if (unauthorized) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  }

  const usedNames = new Map<string, number>()
  const uniqueName = (name: string) => {
    const count = usedNames.get(name) ?? 0
    usedNames.set(name, count + 1)
    if (count === 0) return name
    const dot = name.lastIndexOf('.')
    return dot > 0 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`
  }

  const inputs: InputWithMeta[] = []
  for (const f of rows) {
    const { data: signed, error: signedError } = await supabase.storage
      .from(f.storage_bucket)
      .createSignedUrl(f.storage_path, 600)
    if (signedError || !signed?.signedUrl) continue
    const res = await fetch(signed.signedUrl)
    if (!res.ok || !res.body) continue
    inputs.push({
      name: uniqueName(f.original_name),
      input: res,
      size: f.file_size ?? undefined,
      lastModified: f.updated_at ? new Date(f.updated_at) : undefined,
    })
  }

  if (inputs.length === 0) return NextResponse.json({ error: '다운로드할 파일이 없습니다' }, { status: 502 })

  const zipName = `proby-files-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.zip`
  const zipResponse = downloadZip(inputs)
  return new Response(zipResponse.body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      'Cache-Control': 'no-store',
    },
  })
}
