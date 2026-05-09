'use client'

import { downloadZip, type InputWithMeta } from 'client-zip'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { FileRecord } from '@/lib/types'

type SaveFilePickerOpts = {
  suggestedName?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}
type FsHandle = { createWritable: () => Promise<WritableStream<Uint8Array>> }
declare global {
  interface Window {
    showSaveFilePicker?: (opts?: SaveFilePickerOpts) => Promise<FsHandle>
  }
}

function makeUniqueNamer() {
  const used = new Map<string, number>()
  return (name: string) => {
    const c = used.get(name) ?? 0
    used.set(name, c + 1)
    if (c === 0) return name
    const dot = name.lastIndexOf('.')
    return dot > 0 ? `${name.slice(0, dot)} (${c})${name.slice(dot)}` : `${name} (${c})`
  }
}

async function buildSignedUrlMap(files: FileRecord[]): Promise<Map<string, string>> {
  const supabase = createClient()
  const byBucket = new Map<string, FileRecord[]>()
  for (const f of files) {
    const list = byBucket.get(f.storage_bucket) ?? []
    list.push(f)
    byBucket.set(f.storage_bucket, list)
  }
  const map = new Map<string, string>()
  for (const [bucket, list] of byBucket) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(list.map((f) => f.storage_path), 3600)
    if (error || !data) throw new Error(`서명 URL 생성 실패 (${bucket}): ${error?.message ?? 'unknown'}`)
    list.forEach((f, i) => {
      const item = data[i]
      if (item?.signedUrl) map.set(f.id, item.signedUrl)
    })
  }
  return map
}

export async function runClientZipDownload(files: FileRecord[]): Promise<void> {
  if (files.length === 0) return
  const filename = `proby-files-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.zip`

  const toastId = toast.loading(`${files.length}개 파일 다운로드 준비 중...`)
  let signedUrls: Map<string, string>
  try {
    signedUrls = await buildSignedUrlMap(files)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '서명 URL 생성 실패', { id: toastId })
    return
  }

  const uniqueName = makeUniqueNamer()
  const inputs: InputWithMeta[] = []
  for (const f of files) {
    const url = signedUrls.get(f.id)
    if (!url) continue
    let res: Response
    try {
      res = await fetch(url)
    } catch {
      continue
    }
    if (!res.ok) continue
    inputs.push({
      name: uniqueName(f.original_name),
      input: res,
      size: f.file_size ?? undefined,
      lastModified: f.updated_at ? new Date(f.updated_at) : undefined,
    })
  }

  if (inputs.length === 0) {
    toast.error('다운로드할 파일이 없습니다', { id: toastId })
    return
  }

  toast.loading(`${inputs.length}개 파일을 ZIP으로 묶어 저장 중...`, { id: toastId })
  const zipResponse = downloadZip(inputs)

  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function' && zipResponse.body) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
      })
      const writable = await handle.createWritable()
      await zipResponse.body.pipeTo(writable)
      toast.success(`${inputs.length}개 파일 다운로드 완료`, { id: toastId })
      return
    } catch (e) {
      if (e instanceof Error && (e.name === 'AbortError' || e.message.includes('aborted'))) {
        toast.dismiss(toastId)
        return
      }
      // fall through to blob fallback
    }
  }

  try {
    const blob = await zipResponse.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    toast.success(`${inputs.length}개 파일 다운로드 완료`, { id: toastId })
  } catch (e) {
    toast.error(`ZIP 생성 실패: ${e instanceof Error ? e.message : String(e)}`, { id: toastId })
  }
}
