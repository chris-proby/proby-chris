'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileRecord } from '@/lib/types'
import { formatFileSize } from '@/lib/file-utils'
import { Button } from '@/components/ui/button'
import { X, Download, FileText, ExternalLink } from 'lucide-react'

function getPreviewType(fileType: string): 'video' | 'image' | 'pdf' | 'audio' | 'office' | 'text' | 'none' {
  if (fileType.startsWith('video/')) return 'video'
  if (fileType.startsWith('image/')) return 'image'
  if (fileType === 'application/pdf') return 'pdf'
  if (fileType.startsWith('audio/')) return 'audio'
  if (fileType.startsWith('text/') || fileType === 'application/json') return 'text'
  if ([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
  ].includes(fileType)) return 'office'
  return 'none'
}

export default function FilePreviewModal({ file, onClose }: { file: FileRecord; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const previewType = getPreviewType(file.file_type)

  useEffect(() => {
    const supabase = createClient()
    supabase.storage.from(file.storage_bucket).createSignedUrl(file.storage_path, 3600)
      .then(async ({ data }) => {
        if (!data) return
        setUrl(data.signedUrl)
        if (previewType === 'text') {
          try {
            const res = await fetch(data.signedUrl)
            const text = await res.text()
            setTextContent(text)
          } catch { /* noop */ }
        }
      })
      .finally(() => setLoading(false))
  }, [file, previewType])

  function handleDownload() {
    if (!url) return
    const a = document.createElement('a'); a.href = url; a.download = file.original_name; a.click()
  }

  function handleOpenInNew() {
    if (!url) return
    window.open(url, '_blank')
  }

  const officeViewerUrl = url
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90" onClick={onClose}>
      <div
        className="w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ height: 'min(90vh, 800px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div className="min-w-0">
            <h2 className="text-white font-semibold truncate">{file.name}</h2>
            <p className="text-zinc-500 text-xs mt-0.5">{file.file_type} · {formatFileSize(file.file_size)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="ghost" onClick={handleOpenInNew} disabled={!url} className="text-zinc-400 hover:text-white h-8 gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />새 탭
            </Button>
            <Button size="sm" onClick={handleDownload} disabled={!url} className="bg-indigo-600 hover:bg-indigo-500 text-white h-8 gap-1.5">
              <Download className="w-3.5 h-3.5" />다운로드
            </Button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex items-center justify-center min-h-0">
          {loading ? (
            <div className="text-zinc-500 text-sm">로딩 중...</div>
          ) : !url ? (
            <div className="text-zinc-500 text-sm">미리보기를 불러올 수 없습니다</div>
          ) : previewType === 'video' ? (
            <video src={url} controls className="max-w-full max-h-full rounded-lg" autoPlay />
          ) : previewType === 'image' ? (
            <img src={url} alt={file.name} className="max-w-full max-h-full object-contain" />
          ) : previewType === 'pdf' ? (
            <iframe src={url} className="w-full h-full" title={file.name} />
          ) : previewType === 'audio' ? (
            <div className="flex flex-col items-center gap-6 p-8">
              <div className="w-24 h-24 rounded-2xl bg-pink-500/10 flex items-center justify-center">
                <svg className="w-12 h-12 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
              <p className="text-zinc-300 font-medium">{file.name}</p>
              <audio src={url} controls className="w-full max-w-md" autoPlay />
            </div>
          ) : previewType === 'office' && officeViewerUrl ? (
            <iframe src={officeViewerUrl} className="w-full h-full" title={file.name} />
          ) : previewType === 'text' && textContent !== null ? (
            <div className="w-full h-full overflow-auto p-6">
              <pre className="text-zinc-300 text-sm font-mono whitespace-pre-wrap break-words">{textContent}</pre>
            </div>
          ) : (
            <div className="text-center p-8">
              <FileText className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 text-sm mb-1">이 파일 형식은 미리보기가 지원되지 않습니다</p>
              <p className="text-zinc-600 text-xs mb-6">{file.file_type}</p>
              <Button onClick={handleDownload} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
                <Download className="w-4 h-4" />다운로드
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
