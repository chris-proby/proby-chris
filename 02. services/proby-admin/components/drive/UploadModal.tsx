'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import * as tus from 'tus-js-client'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { formatFileSize, getFileIcon } from '@/lib/file-utils'
import { X, Upload, CheckCircle2, AlertCircle, Video, FileText, Image, Music, File } from 'lucide-react'

interface UploadFile { id: string; file: File; name: string; status: 'pending' | 'uploading' | 'done' | 'error'; progress: number; error?: string }
const iconMap = { video: Video, document: FileText, image: Image, audio: Music, file: File }
const colorMap = { video: 'text-blue-400', document: 'text-green-400', image: 'text-purple-400', audio: 'text-pink-400', file: 'text-zinc-400' }

export default function UploadModal({ companyId, folderId, onClose, onComplete, initialFiles }: { companyId: string; folderId: string | null; onClose: () => void; onComplete: () => void; initialFiles?: File[] }) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>(() =>
    (initialFiles ?? []).map((f) => ({ id: crypto.randomUUID(), file: f, name: f.name, status: 'pending' as const, progress: 0 }))
  )
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addFiles(newFiles: FileList | File[]) {
    setUploadFiles((prev) => [...prev, ...Array.from(newFiles).map((f) => ({ id: crypto.randomUUID(), file: f, name: f.name, status: 'pending' as const, progress: 0 }))])
  }

  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files) }, [])

  function updateFile(id: string, update: Partial<UploadFile>) {
    setUploadFiles((prev) => prev.map((f) => f.id === id ? { ...f, ...update } : f))
  }

  async function uploadSingleFile(uf: UploadFile): Promise<boolean> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: { session } } = await supabase.auth.getSession()
    const ext = uf.file.name.includes('.') ? uf.file.name.split('.').pop()?.toLowerCase() : ''
    const storagePath = `${companyId}/${folderId ?? 'root'}/${crypto.randomUUID()}${ext ? '.' + ext : ''}`
    const contentType = uf.file.type || detectMimeFromExt(ext ?? '') || 'application/octet-stream'
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const token = session?.access_token ?? ''

    updateFile(uf.id, { status: 'uploading', progress: 0 })

    try {
      // TUS 청크 업로드 (대용량 파일 지원, 실제 진행률 제공)
      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(uf.file, {
          endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000, 10000],
          headers: {
            Authorization: `Bearer ${token}`,
            'x-upsert': 'false',
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: {
            bucketName: 'files',
            objectName: storagePath,
            contentType,
            cacheControl: '3600',
          },
          chunkSize: 6 * 1024 * 1024, // 6MB 청크
          onError: (err) => reject(err),
          onProgress: (bytesUploaded, bytesTotal) => {
            // 0~90% 구간을 실제 업로드에 사용
            const pct = Math.round((bytesUploaded / bytesTotal) * 90)
            updateFile(uf.id, { progress: pct })
          },
          onSuccess: () => resolve(),
        })
        upload.findPreviousUploads().then((prev) => {
          if (prev.length > 0) upload.resumeFromPreviousUpload(prev[0])
          upload.start()
        })
      })

      updateFile(uf.id, { progress: 95 })

      const { error: dbError } = await supabase.from('files').insert({
        company_id: companyId,
        folder_id: folderId,
        name: uf.name,
        original_name: uf.file.name,
        file_type: contentType,
        file_size: uf.file.size,
        storage_path: storagePath,
        storage_bucket: 'files',
        created_by: user?.id ?? null,
      })
      if (dbError) throw dbError

      updateFile(uf.id, { status: 'done', progress: 100 })
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : '업로드 실패'
      updateFile(uf.id, { status: 'error', error: msg })
      return false
    }
  }

  async function handleUploadAll() {
    const pending = uploadFiles.filter((f) => f.status === 'pending')
    if (!pending.length) return
    setUploading(true)
    let ok = 0
    for (const uf of pending) { if (await uploadSingleFile(uf)) ok++ }
    setUploading(false)
    if (ok === pending.length) { toast.success(`${ok}개 파일 업로드 완료`); setTimeout(onComplete, 500) }
    else toast.error(`${pending.length - ok}개 파일 업로드 실패`)
  }

  // initialFiles가 있으면 모달 열리는 즉시 자동 업로드 시작
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      const t = setTimeout(handleUploadAll, 150)
      return () => clearTimeout(t)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pendingCount = uploadFiles.filter((f) => f.status === 'pending').length
  const allDone = uploadFiles.length > 0 && uploadFiles.every((f) => f.status === 'done' || f.status === 'error')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div><h2 className="text-white font-semibold">파일 업로드</h2><p className="text-zinc-500 text-xs mt-0.5">동영상, 문서 등 모든 형식 지원</p></div>
          <button onClick={onClose} disabled={uploading} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50'}`}
          >
            <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
            <p className="text-zinc-300 text-sm font-medium">파일을 드래그하거나 클릭해서 선택</p>
            <p className="text-zinc-600 text-xs mt-1">MP4, MOV, MKV, PDF, DOCX, 이미지 등 모든 형식</p>
            {/* accept 제거 → 모든 파일 허용, 동영상 포함 */}
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
          </div>
          {uploadFiles.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {uploadFiles.map((uf) => {
                const Icon = iconMap[getFileIcon(uf.file.type || detectMimeFromExt(uf.file.name.split('.').pop() ?? ''))]
                const color = colorMap[getFileIcon(uf.file.type || detectMimeFromExt(uf.file.name.split('.').pop() ?? ''))]
                return (
                  <div key={uf.id} className="flex items-center gap-3 p-3 bg-zinc-800 rounded-xl">
                    <Icon className={`w-5 h-5 shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-200 text-sm font-medium truncate">{uf.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-zinc-600 text-xs">{formatFileSize(uf.file.size)}</span>
                        {uf.status === 'uploading' && (
                          <div className="flex items-center gap-1.5 flex-1">
                            <Progress value={uf.progress} className="h-1 flex-1" />
                            <span className="text-zinc-500 text-xs shrink-0">{uf.progress}%</span>
                          </div>
                        )}
                        {uf.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                        {uf.status === 'error' && <span className="text-red-400 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" />{uf.error}</span>}
                      </div>
                    </div>
                    {uf.status === 'pending' && (
                      <button onClick={() => setUploadFiles((p) => p.filter((f) => f.id !== uf.id))} className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors shrink-0"><X className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800">
          <span className="text-zinc-500 text-xs">{uploadFiles.length > 0 ? `${uploadFiles.length}개 선택 (${pendingCount}개 대기)` : '파일을 선택해주세요'}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={uploading} className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white">취소</Button>
            {allDone ? (
              <Button size="sm" onClick={onComplete} className="bg-green-600 hover:bg-green-500 text-white"><CheckCircle2 className="w-4 h-4 mr-1.5" />완료</Button>
            ) : (
              <Button size="sm" onClick={handleUploadAll} disabled={pendingCount === 0 || uploading} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {uploading ? '업로드 중...' : <><Upload className="w-3.5 h-3.5 mr-1.5" />{pendingCount > 0 ? `${pendingCount}개 업로드` : '업로드'}</>}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 확장자 기반 MIME 타입 추론 (브라우저가 MIME을 비워두는 경우 대비)
function detectMimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
    mkv: 'video/x-matroska', webm: 'video/webm', wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv', m4v: 'video/x-m4v', '3gp': 'video/3gpp',
    mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', flac: 'audio/flac',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', heic: 'image/heic',
    pdf: 'application/pdf',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain', csv: 'text/csv', zip: 'application/zip',
  }
  return map[ext.toLowerCase()] ?? ''
}
