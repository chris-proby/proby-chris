'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Folder, FileRecord } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import FolderItem from './FolderItem'
import FileItem from './FileItem'
import UploadModal from './UploadModal'
import NewFolderModal from './NewFolderModal'
import FilePreviewModal from './FilePreviewModal'
import MoveModal from './MoveModal'
import { ChevronRight, Home, FolderPlus, Upload, Search, LayoutGrid, List, CheckSquare, X, MoveRight, Download } from 'lucide-react'
import { toast } from 'sonner'
import { trackMixpanel } from '@/lib/analytics/mixpanel'

interface DriveViewProps {
  folders: Folder[]
  files: FileRecord[]
  breadcrumbs: { id: string; name: string }[]
  currentFolderId: string | null
  companyId: string
  primaryColor?: string
  secondaryColor?: string
  isReadOnly?: boolean
  driveBasePath?: string
}

export default function DriveView({ folders, files, breadcrumbs, currentFolderId, companyId, primaryColor = '#6366f1', secondaryColor = '#8b5cf6', isReadOnly = false, driveBasePath = '/drive' }: DriveViewProps) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkMove, setShowBulkMove] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<File[] | undefined>(undefined)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  const filteredFolders = folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredFiles = files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const isEmpty = filteredFolders.length === 0 && filteredFiles.length === 0
  const selectedFiles = files.filter((f) => selectedIds.has(f.id))
  const allSelected = filteredFiles.length > 0 && filteredFiles.every((f) => selectedIds.has(f.id))

  function handleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => { const next = new Set(prev); checked ? next.add(id) : next.delete(id); return next })
  }

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredFiles.map((f) => f.id)))
  }

  const handleDropFile = useCallback(async (folderId: string, fileId: string) => {
    const idsToMove = selectedIds.has(fileId) ? Array.from(selectedIds) : [fileId]
    const { error } = await createClient().from('files').update({ folder_id: folderId }).in('id', idsToMove)
    if (error) { toast.error('이동 실패'); return }
    toast.success(`${idsToMove.length}개 파일을 이동했습니다`)
    setSelectedIds(new Set())
    router.refresh()
  }, [selectedIds, router])

  // 외부 파일 드래그앤드롭 핸들러 (OS → 드라이브 업로드)
  function handleGlobalDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return
    dragCounter.current++
    setIsDragOver(true)
  }

  function handleGlobalDragLeave(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return
    dragCounter.current--
    if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragOver(false) }
  }

  function handleGlobalDrop(e: React.DragEvent) {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragOver(false)
    if (e.dataTransfer.files?.length) {
      trackMixpanel('Drive_Files_Dropped_For_Upload', { file_count: e.dataTransfer.files.length, company_id: companyId, folder_id: currentFolderId })
      setDroppedFiles(Array.from(e.dataTransfer.files))
      setShowUpload(true)
    }
  }

  async function handleBulkDownload() {
    const supabase = createClient()
    trackMixpanel('Drive_Bulk_Download_Started', { file_count: selectedFiles.length, company_id: companyId })
    toast.info(`${selectedFiles.length}개 파일 다운로드를 시작합니다...`)
    for (const file of selectedFiles) {
      const { data, error } = await supabase.storage.from(file.storage_bucket).createSignedUrl(file.storage_path, 60)
      if (error || !data?.signedUrl) { toast.error(`${file.original_name} 다운로드 실패`); continue }
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = file.original_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0 relative"
      onDragEnter={!isReadOnly ? handleGlobalDragEnter : undefined}
      onDragLeave={!isReadOnly ? handleGlobalDragLeave : undefined}
      onDragOver={!isReadOnly ? (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() } : undefined}
      onDrop={!isReadOnly ? handleGlobalDrop : undefined}
    >
      {/* 드래그 오버 오버레이 */}
      {!isReadOnly && isDragOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 border-2 border-dashed border-indigo-400 rounded-xl pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
              <Upload className="w-8 h-8 text-indigo-400" />
            </div>
            <p className="text-white text-lg font-semibold">여기에 놓으면 업로드됩니다</p>
            <p className="text-zinc-400 text-sm">모든 파일 형식 지원</p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800 shrink-0">
        <nav className="flex items-center gap-1 flex-1 min-w-0">
          <Link href={driveBasePath} className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm">
            <Home className="w-3.5 h-3.5 shrink-0" /><span className="hidden sm:inline">내 드라이브</span>
          </Link>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <Link href={`${driveBasePath}?folder=${crumb.id}`} className="text-zinc-400 hover:text-white transition-colors text-sm truncate max-w-32">{crumb.name}</Link>
            </span>
          ))}
        </nav>
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input placeholder="검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 w-40 sm:w-56 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 text-sm focus-visible:ring-indigo-500" />
        </div>
        <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-0.5 shrink-0">
          <button onClick={() => {
            setViewMode('grid')
            trackMixpanel('Drive_View_Mode_Changed', { mode: 'grid', company_id: companyId })
          }} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><LayoutGrid className="w-3.5 h-3.5" /></button>
          <button onClick={() => {
            setViewMode('list')
            trackMixpanel('Drive_View_Mode_Changed', { mode: 'list', company_id: companyId })
          }} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><List className="w-3.5 h-3.5" /></button>
        </div>
        {!isReadOnly && (
          <>
            <Button size="sm" variant="outline" onClick={() => {
              setShowNewFolder(true)
              trackMixpanel('Drive_New_Folder_Button_Clicked', { company_id: companyId, folder_id: currentFolderId })
            }} className="h-8 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white shrink-0">
              <FolderPlus className="w-3.5 h-3.5 mr-1.5" /><span className="hidden sm:inline">새 폴더</span>
            </Button>
            <Button size="sm" onClick={() => {
              setShowUpload(true)
              trackMixpanel('Drive_Upload_Button_Clicked', { company_id: companyId, folder_id: currentFolderId })
            }} className="h-8 text-white shrink-0" style={{ backgroundColor: primaryColor }}>
              <Upload className="w-3.5 h-3.5 mr-1.5" />업로드
            </Button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full min-h-64 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-2">
              <Upload className="w-7 h-7 text-zinc-500" />
            </div>
            <div><p className="text-white font-medium">파일이 없습니다</p><p className="text-zinc-500 text-sm mt-1">{isReadOnly ? '아직 업로드된 파일이 없습니다' : '파일을 업로드하거나 폴더를 만들어 시작하세요'}</p></div>
            {!isReadOnly && <Button onClick={() => setShowUpload(true)} className="text-white" style={{ backgroundColor: primaryColor }}><Upload className="w-4 h-4 mr-2" />파일 업로드</Button>}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredFolders.length > 0 && (
              <section>
                <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">폴더 ({filteredFolders.length})</h2>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {filteredFolders.map((f) => <FolderItem key={f.id} folder={f} viewMode="grid" hrefBase={driveBasePath} onDropFile={isReadOnly ? undefined : handleDropFile} onDeleted={isReadOnly ? undefined : () => router.refresh()} />)}
                  </div>
                ) : (
                  <div className="space-y-1">{filteredFolders.map((f) => <FolderItem key={f.id} folder={f} viewMode="list" hrefBase={driveBasePath} onDropFile={isReadOnly ? undefined : handleDropFile} onDeleted={isReadOnly ? undefined : () => router.refresh()} />)}</div>
                )}
              </section>
            )}
            {filteredFiles.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">파일 ({filteredFiles.length})</h2>
                  {!isReadOnly && (
                    <button onClick={toggleSelectAll} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1">
                      <CheckSquare className="w-3 h-3" />{allSelected ? '전체 해제' : '전체 선택'}
                    </button>
                  )}
                </div>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {filteredFiles.map((f) => <FileItem key={f.id} file={f} viewMode="grid" isReadOnly={isReadOnly} onPreview={() => {
                    trackMixpanel('Drive_File_Preview_Opened', { file_id: f.id, file_name: f.name, file_type: f.file_type, company_id: companyId })
                    setPreviewFile(f)
                  }} onDeleted={isReadOnly ? undefined : () => { setSelectedIds((p) => { const n = new Set(p); n.delete(f.id); return n }); router.refresh() }} isSelected={selectedIds.has(f.id)} onSelect={isReadOnly ? undefined : handleSelect} />)}
                  </div>
                ) : (
                  <div className="space-y-1">{filteredFiles.map((f) => <FileItem key={f.id} file={f} viewMode="list" isReadOnly={isReadOnly} onPreview={() => {
                    trackMixpanel('Drive_File_Preview_Opened', { file_id: f.id, file_name: f.name, file_type: f.file_type, company_id: companyId })
                    setPreviewFile(f)
                  }} onDeleted={isReadOnly ? undefined : () => { setSelectedIds((p) => { const n = new Set(p); n.delete(f.id); return n }); router.refresh() }} isSelected={selectedIds.has(f.id)} onSelect={isReadOnly ? undefined : handleSelect} />)}</div>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      {/* 일괄 액션 바 */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-3 px-6 py-3 border-t shrink-0"
          style={{ background: `linear-gradient(135deg, var(--brand-primary-10), var(--brand-secondary-10))`, borderColor: 'var(--brand-primary-20)' }}
        >
          <span className="text-white text-sm font-medium">{selectedIds.size}개 선택됨</span>
          <div className="flex-1" />
          {isReadOnly ? (
            <Link href="/login" className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-white/20 text-white text-xs hover:bg-white/10 transition-colors">
              <Download className="w-3.5 h-3.5" />로그인 후 다운로드
            </Link>
          ) : (
            <Button size="sm" variant="outline" onClick={handleBulkDownload} className="h-8 bg-transparent border-white/20 text-white hover:bg-white/10">
              <Download className="w-3.5 h-3.5 mr-1.5" />다운로드
            </Button>
          )}
          {!isReadOnly && (
            <Button size="sm" onClick={() => {
              setShowBulkMove(true)
              trackMixpanel('Drive_Bulk_Move_Button_Clicked', { file_count: selectedIds.size, company_id: companyId })
            }} className="h-8 text-white" style={{ backgroundColor: primaryColor }}>
              <MoveRight className="w-3.5 h-3.5 mr-1.5" />이동
            </Button>
          )}
          <button onClick={() => setSelectedIds(new Set())} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!isReadOnly && showUpload && <UploadModal companyId={companyId} folderId={currentFolderId} initialFiles={droppedFiles} onClose={() => { setShowUpload(false); setDroppedFiles(undefined) }} onComplete={() => { setShowUpload(false); setDroppedFiles(undefined); router.refresh() }} />}
      {!isReadOnly && showNewFolder && <NewFolderModal companyId={companyId} parentId={currentFolderId} onClose={() => setShowNewFolder(false)} onCreated={() => { setShowNewFolder(false); router.refresh() }} />}
      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      {!isReadOnly && showBulkMove && <MoveModal files={selectedFiles} onClose={() => setShowBulkMove(false)} onMoved={() => { setShowBulkMove(false); setSelectedIds(new Set()); router.refresh() }} />}
    </div>
  )
}
