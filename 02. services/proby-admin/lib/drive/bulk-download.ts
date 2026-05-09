'use client'

import { downloadZip } from 'client-zip'
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

  // 1. Open Save dialog FIRST while user activation is still fresh.
  //    Any other await before this would break user gesture context.
  let handle: FsHandle | null = null
  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
      })
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      // 기능 미지원 / 차단 시 → blob 폴백으로 진행
      handle = null
    }
  }

  const toastId = toast.loading(`${files.length}개 파일 다운로드 준비 중...`)
  let signedUrls: Map<string, string>
  try {
    signedUrls = await buildSignedUrlMap(files)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '서명 URL 생성 실패', { id: toastId })
    return
  }

  const uniqueName = makeUniqueNamer()
  let done = 0
  let skipped = 0

  async function* sourceInputs() {
    for (const f of files) {
      const url = signedUrls.get(f.id)
      if (!url) { skipped++; continue }
      let res: Response
      try {
        res = await fetch(url)
      } catch {
        skipped++
        continue
      }
      if (!res.ok) { skipped++; continue }
      done++
      toast.loading(`${done}/${files.length} 다운로드 중...`, { id: toastId })
      yield {
        name: uniqueName(f.original_name),
        input: res,
        size: f.file_size ?? undefined,
        lastModified: f.updated_at ? new Date(f.updated_at) : undefined,
      }
    }
  }

  const zipResponse = downloadZip(sourceInputs())

  if (handle) {
    try {
      const writable = await handle.createWritable()
      await zipResponse.body!.pipeTo(writable)
      toast.success(skipped > 0 ? `${done}개 다운로드 완료 (${skipped}개 실패)` : `${done}개 파일 다운로드 완료`, { id: toastId })
    } catch (e) {
      toast.error(`ZIP 저장 실패: ${e instanceof Error ? e.message : String(e)}`, { id: toastId })
    }
    return
  }

  // Fallback: buffer entire ZIP into memory and trigger <a download>
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
    toast.success(skipped > 0 ? `${done}개 다운로드 완료 (${skipped}개 실패)` : `${done}개 파일 다운로드 완료`, { id: toastId })
  } catch (e) {
    toast.error(`ZIP 생성 실패: ${e instanceof Error ? e.message : String(e)}`, { id: toastId })
  }
}
