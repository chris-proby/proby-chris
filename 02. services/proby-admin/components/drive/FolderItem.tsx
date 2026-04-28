'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Folder } from '@/lib/types'
import { formatDate } from '@/lib/file-utils'
import { Folder as FolderIcon, ChevronRight, MoreVertical, Trash2, Lock, Pencil } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import FolderPermissionModal from './FolderPermissionModal'

interface FolderItemProps {
  folder: Folder
  viewMode: 'grid' | 'list'
  hrefBase?: string
  onDropFile?: (folderId: string, fileId: string) => void
  onDeleted?: () => void
  isAdmin?: boolean
  companyId?: string
  isRestricted?: boolean  // shows a lock badge
}

export default function FolderItem({ folder, viewMode, hrefBase = '/drive', onDropFile, onDeleted, isAdmin, companyId, isRestricted }: FolderItemProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [showPermissions, setShowPermissions] = useState(false)
  const href = `${hrefBase}?folder=${folder.id}`

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }
  function handleDragLeave() { setIsDragOver(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const fileId = e.dataTransfer.getData('fileId')
    if (fileId && onDropFile) onDropFile(folder.id, fileId)
  }

  async function handleRename(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const next = prompt('새 폴더 이름을 입력하세요', folder.name)?.trim()
    if (!next || next === folder.name) return
    setRenaming(true)
    try {
      const { error } = await createClient().from('folders').update({ name: next }).eq('id', folder.id)
      if (error) throw error
      toast.success('이름이 변경됐습니다')
      onDeleted?.()
    } catch {
      toast.error('이름 변경 실패')
    } finally {
      setRenaming(false)
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`"${folder.name}" 폴더를 삭제하시겠습니까?\n내부의 모든 파일도 함께 삭제됩니다.`)) return
    setDeleting(true)
    try {
      const supabase = createClient()
      const { data: folderFiles } = await supabase.from('files').select('storage_bucket, storage_path').eq('folder_id', folder.id)
      if (folderFiles && folderFiles.length > 0) {
        const byBucket: Record<string, string[]> = {}
        for (const f of folderFiles) {
          if (!byBucket[f.storage_bucket]) byBucket[f.storage_bucket] = []
          byBucket[f.storage_bucket].push(f.storage_path)
        }
        for (const [bucket, paths] of Object.entries(byBucket)) {
          await supabase.storage.from(bucket).remove(paths)
        }
      }
      const { error } = await supabase.from('folders').delete().eq('id', folder.id)
      if (error) throw error
      toast.success(`"${folder.name}" 폴더가 삭제됐습니다`)
      onDeleted?.()
    } catch {
      toast.error('폴더 삭제 실패')
      setDeleting(false)
    }
  }

  const hasMenu = onDeleted || (isAdmin && companyId)

  const menuButton = hasMenu ? (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      } />
      <DropdownMenuContent align="end" className="w-40 bg-zinc-900 border-zinc-800">
        {isAdmin && companyId && (
          <>
            <DropdownMenuItem
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPermissions(true) }}
              className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer"
            >
              <Lock className="w-4 h-4 mr-2" />권한 설정
            </DropdownMenuItem>
            {onDeleted && <DropdownMenuSeparator className="bg-zinc-800" />}
          </>
        )}
        {onDeleted && (
          <DropdownMenuItem
            onClick={handleRename}
            disabled={renaming}
            className="text-zinc-300 focus:bg-zinc-800 focus:text-white cursor-pointer"
          >
            <Pencil className="w-4 h-4 mr-2" />{renaming ? '변경 중...' : '이름 변경'}
          </DropdownMenuItem>
        )}
        {onDeleted && (
          <DropdownMenuItem
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-400 focus:bg-zinc-800 focus:text-red-300 cursor-pointer"
          >
            <Trash2 className="w-4 h-4 mr-2" />{deleting ? '삭제 중...' : '삭제'}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null

  const lockBadge = isRestricted ? (
    <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center">
      <Lock className="w-2.5 h-2.5 text-indigo-400" />
    </span>
  ) : null

  if (viewMode === 'list') {
    return (
      <>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors group ${isDragOver ? 'bg-amber-500/10 ring-1 ring-amber-500/50 scale-[1.01]' : ''} ${deleting ? 'opacity-50' : ''}`}>
          <Link
            href={href}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <FolderIcon className={`w-5 h-5 shrink-0 transition-colors ${isDragOver ? 'text-amber-300' : 'text-amber-400'}`} fill="currentColor" fillOpacity={isDragOver ? 0.5 : 0.3} />
            <span className="flex-1 text-zinc-200 text-sm font-medium truncate group-hover:text-white">{folder.name}</span>
            {lockBadge}
            {isDragOver && <span className="text-amber-400 text-xs font-medium shrink-0">여기에 이동</span>}
            <span className="text-zinc-600 text-xs shrink-0">{formatDate(folder.created_at)}</span>
            <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
          </Link>
          {menuButton}
        </div>
        {showPermissions && companyId && (
          <FolderPermissionModal folder={folder} companyId={companyId} onClose={() => setShowPermissions(false)} />
        )}
      </>
    )
  }

  return (
    <>
      <div className={`flex flex-col items-center gap-2.5 p-3 rounded-xl hover:bg-zinc-800 transition-all group relative ${isDragOver ? 'bg-amber-500/10 ring-2 ring-amber-500/50 scale-105' : ''} ${deleting ? 'opacity-50' : ''}`}>
        <Link
          href={href}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex flex-col items-center gap-2.5 w-full"
        >
          <div className="w-14 h-14 flex items-center justify-center relative">
            <FolderIcon
              className={`w-14 h-12 transition-colors ${isDragOver ? 'text-amber-300' : 'text-amber-400 group-hover:text-amber-300'}`}
              fill="currentColor"
              fillOpacity={isDragOver ? 0.5 : 0.25}
              strokeWidth={1.2}
            />
            {isRestricted && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-700">
                <Lock className="w-2 h-2 text-indigo-400" />
              </span>
            )}
          </div>
          <span className={`text-xs text-center truncate w-full transition-colors leading-tight ${isDragOver ? 'text-amber-300' : 'text-zinc-300 group-hover:text-white'}`}>
            {folder.name}
          </span>
          {isDragOver && (
            <span className="text-[10px] text-amber-400 font-medium -mt-1">여기에 이동</span>
          )}
        </Link>
        {menuButton && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {menuButton}
          </div>
        )}
      </div>
      {showPermissions && companyId && (
        <FolderPermissionModal folder={folder} companyId={companyId} onClose={() => setShowPermissions(false)} />
      )}
    </>
  )
}
