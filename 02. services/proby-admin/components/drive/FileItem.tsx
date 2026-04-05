'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileRecord } from '@/lib/types'
import { formatFileSize, formatDate, getFileIcon } from '@/lib/file-utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { Video, FileText, Image, Music, File, MoreVertical, Download, Eye, Trash2, MoveRight, Check } from 'lucide-react'
import MoveModal from './MoveModal'

const iconMap = { video: Video, document: FileText, image: Image, audio: Music, file: File }
const colorMap = { video: 'text-blue-400 bg-blue-500/10', document: 'text-green-400 bg-green-500/10', image: 'text-purple-400 bg-purple-500/10', audio: 'text-pink-400 bg-pink-500/10', file: 'text-zinc-400 bg-zinc-500/10' }

interface FileItemProps {
  file: FileRecord
  viewMode: 'grid' | 'list'
  onPreview: () => void
  onDeleted: () => void
  isSelected?: boolean
  onSelect?: (id: string, checked: boolean) => void
}

export default function FileItem({ file, viewMode, onPreview, onDeleted, isSelected = false, onSelect }: FileItemProps) {
  const [downloading, setDownloading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showMove, setShowMove] = useState(false)
  const iconType = getFileIcon(file.file_type)
  const Icon = iconMap[iconType]
  const colorClass = colorMap[iconType]

  async function handleDownload() {
    setDownloading(true)
    try {
      const { data, error } = await createClient().storage.from(file.storage_bucket).createSignedUrl(file.storage_path, 3600)
      if (error || !data) throw error ?? new Error('URL 생성 실패')
      const a = document.createElement('a'); a.href = data.signedUrl; a.download = file.original_name; a.click()
    } catch { toast.error('다운로드 실패') } finally { setDownloading(false) }
  }

  async function handleDelete() {
    if (!confirm(`"${file.name}" 파일을 삭제하시겠습니까?`)) return
    setDeleting(true)
    try {
      await createClient().storage.from(file.storage_bucket).remove([file.storage_path])
      const { error } = await createClient().from('files').delete().eq('id', file.id)
      if (error) throw error
      toast.success('파일이 삭제됐습니다'); onDeleted()
    } catch { toast.error('삭제 실패'); setDeleting(false) }
  }

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('fileId', file.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const contextMenu = (
    <DropdownMenuContent align="end" className="w-40 bg-zinc-900 border-zinc-800">
      <DropdownMenuItem onClick={onPreview} className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer"><Eye className="w-4 h-4 mr-2" />미리보기</DropdownMenuItem>
      <DropdownMenuItem onClick={handleDownload} disabled={downloading} className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer"><Download className="w-4 h-4 mr-2" />{downloading ? '다운로드 중...' : '다운로드'}</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setShowMove(true)} className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer"><MoveRight className="w-4 h-4 mr-2" />이동</DropdownMenuItem>
      <DropdownMenuSeparator className="bg-zinc-800" />
      <DropdownMenuItem onClick={handleDelete} className="text-red-400 focus:bg-zinc-800 focus:text-red-300 cursor-pointer"><Trash2 className="w-4 h-4 mr-2" />삭제</DropdownMenuItem>
    </DropdownMenuContent>
  )

  if (viewMode === 'list') {
    return (
      <>
        <div
          draggable
          onDragStart={handleDragStart}
          onClick={onPreview}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors group cursor-pointer ${deleting ? 'opacity-50' : ''} ${isSelected ? 'bg-indigo-600/10 ring-1 ring-indigo-500/30' : ''}`}
        >
          {onSelect && (
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(file.id, !isSelected) }}
              className={`w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-zinc-600 hover:border-zinc-400 bg-transparent'}`}
            >
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </button>
          )}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}><Icon className="w-4 h-4" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-200 text-sm font-medium truncate group-hover:text-white">{file.name}</p>
            {file.description && <p className="text-zinc-600 text-xs truncate">{file.description}</p>}
          </div>
          <span className="text-zinc-600 text-xs shrink-0">{formatFileSize(file.file_size)}</span>
          <span className="text-zinc-600 text-xs shrink-0 hidden sm:block">{formatDate(file.created_at)}</span>
          <DropdownMenu><DropdownMenuTrigger render={<button onClick={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100"><MoreVertical className="w-4 h-4" /></button>} />{contextMenu}</DropdownMenu>
        </div>
        {showMove && <MoveModal files={[file]} onClose={() => setShowMove(false)} onMoved={() => { setShowMove(false); onDeleted() }} />}
      </>
    )
  }

  return (
    <>
      <div
        draggable
        onDragStart={handleDragStart}
        onClick={onPreview}
        className={`flex flex-col gap-2.5 p-3 rounded-xl hover:bg-zinc-800 transition-colors group relative cursor-pointer ${deleting ? 'opacity-50' : ''} ${isSelected ? 'bg-indigo-600/10 ring-1 ring-indigo-500/30' : ''}`}
      >
        {onSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(file.id, !isSelected) }}
            className={`absolute top-2 left-2 w-5 h-5 rounded border flex items-center justify-center transition-all z-10 ${isSelected ? 'bg-indigo-600 border-indigo-600 opacity-100' : 'border-zinc-600 bg-zinc-900/80 opacity-0 group-hover:opacity-100'}`}
          >
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </button>
        )}
        <div className={`w-full aspect-square rounded-lg flex items-center justify-center ${colorClass}`}>
          <Icon className="w-8 h-8" />
        </div>
        <div className="min-w-0">
          <p className="text-zinc-300 text-xs font-medium truncate group-hover:text-white transition-colors">{file.name}</p>
          <p className="text-zinc-600 text-[10px]">{formatFileSize(file.file_size)}</p>
        </div>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu><DropdownMenuTrigger render={<button onClick={(e) => e.stopPropagation()} className="p-1 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white transition-colors"><MoreVertical className="w-3.5 h-3.5" /></button>} />{contextMenu}</DropdownMenu>
        </div>
      </div>
      {showMove && <MoveModal files={[file]} onClose={() => setShowMove(false)} onMoved={() => { setShowMove(false); onDeleted() }} />}
    </>
  )
}
