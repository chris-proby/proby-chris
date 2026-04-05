'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileRecord, Folder } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { X, FolderOpen, Home, ChevronRight, MoveRight, Folder as FolderIcon } from 'lucide-react'

interface MoveModalProps {
  files: FileRecord[]
  onClose: () => void
  onMoved: () => void
}

export default function MoveModal({ files, onClose, onMoved }: MoveModalProps) {
  const companyId = files[0]?.company_id ?? ''
  const currentFolderId = files.length === 1 ? files[0].folder_id : null
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId)
  const [browseFolderId, setBrowseFolderId] = useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([])
  const [moving, setMoving] = useState(false)
  const supabase = createClient()

  useEffect(() => { loadFolders(browseFolderId) }, [browseFolderId])

  async function loadFolders(parentId: string | null) {
    const query = supabase.from('folders').select('*').eq('company_id', companyId).order('name')
    const { data } = parentId ? await query.eq('parent_id', parentId) : await query.is('parent_id', null)
    setFolders((data as Folder[]) ?? [])
  }

  async function navigateTo(folderId: string | null) {
    if (folderId === null) {
      setBreadcrumbs([])
    } else {
      const { data } = await supabase.from('folders').select('id, name, parent_id').eq('id', folderId).single()
      if (data) {
        const f = data as { id: string; name: string; parent_id: string | null }
        setBreadcrumbs((prev) => {
          const existing = prev.findIndex((b) => b.id === folderId)
          if (existing !== -1) return prev.slice(0, existing + 1)
          return [...prev, { id: f.id, name: f.name }]
        })
      }
    }
    setBrowseFolderId(folderId)
    setSelectedFolderId(folderId)
  }

  async function handleMove() {
    setMoving(true)
    const ids = files.map((f) => f.id)
    const { error } = await supabase.from('files').update({ folder_id: selectedFolderId }).in('id', ids)
    if (error) { toast.error('이동 실패', { description: error.message }); setMoving(false); return }
    toast.success(`${files.length}개 파일을 이동했습니다`)
    onMoved()
  }

  const isSameLocation = files.length === 1 && selectedFolderId === files[0].folder_id
  const destinationLabel = selectedFolderId === null ? '루트 (최상위)' : breadcrumbs.find((b) => b.id === selectedFolderId)?.name ?? folders.find((f) => f.id === selectedFolderId)?.name ?? '선택된 폴더'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-white font-semibold flex items-center gap-2"><MoveRight className="w-4 h-4 text-indigo-400" />파일 이동</h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              {files.length === 1 ? `"${files[0].name}"` : `${files.length}개 파일`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => navigateTo(null)} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${browseFolderId === null ? 'bg-indigo-600/20 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}>
              <Home className="w-3 h-3" />루트
            </button>
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.id} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-zinc-600" />
                <button onClick={() => { setBreadcrumbs(breadcrumbs.slice(0, i + 1)); setBrowseFolderId(crumb.id); setSelectedFolderId(crumb.id) }} className={`text-xs px-2 py-1 rounded-md transition-colors ${browseFolderId === crumb.id ? 'bg-indigo-600/20 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}>{crumb.name}</button>
              </span>
            ))}
          </div>
          <div className="border border-zinc-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            <button onClick={() => setSelectedFolderId(browseFolderId)} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-zinc-800 ${selectedFolderId === browseFolderId ? 'bg-indigo-600/15 border-l-2 border-l-indigo-500' : 'hover:bg-zinc-800/50'}`}>
              <FolderOpen className={`w-4 h-4 shrink-0 ${selectedFolderId === browseFolderId ? 'text-indigo-400' : 'text-amber-400'}`} />
              <span className={`text-sm font-medium ${selectedFolderId === browseFolderId ? 'text-indigo-300' : 'text-zinc-300'}`}>{browseFolderId === null ? '루트 (최상위)' : breadcrumbs[breadcrumbs.length - 1]?.name ?? '현재 폴더'}</span>
              {selectedFolderId === browseFolderId && <span className="ml-auto text-indigo-400 text-xs">선택됨</span>}
            </button>
            {folders.length === 0 ? (
              <div className="px-4 py-6 text-center text-zinc-600 text-sm">하위 폴더 없음</div>
            ) : folders.map((folder) => (
              <div key={folder.id} className={`flex items-center border-b border-zinc-800/50 last:border-0 ${selectedFolderId === folder.id ? 'bg-indigo-600/15 border-l-2 border-l-indigo-500' : 'hover:bg-zinc-800/50'}`}>
                <button onClick={() => setSelectedFolderId(folder.id)} className="flex-1 flex items-center gap-3 px-4 py-3 text-left">
                  <FolderIcon className={`w-4 h-4 shrink-0 ${selectedFolderId === folder.id ? 'text-indigo-400' : 'text-amber-400'}`} fill="currentColor" fillOpacity={0.2} />
                  <span className={`text-sm ${selectedFolderId === folder.id ? 'text-indigo-300 font-medium' : 'text-zinc-300'}`}>{folder.name}</span>
                  {selectedFolderId === folder.id && <span className="ml-auto text-indigo-400 text-xs mr-2">선택됨</span>}
                </button>
                <button onClick={() => navigateTo(folder.id)} className="px-3 py-3 text-zinc-600 hover:text-zinc-400 transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg text-xs text-zinc-400">
            <span>이동 위치:</span>
            <span className="text-white font-medium">{destinationLabel}</span>
            {isSameLocation && <span className="text-zinc-600">(현재 위치)</span>}
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-zinc-800">
          <Button variant="outline" onClick={onClose} className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white">취소</Button>
          <Button onClick={handleMove} disabled={moving || isSameLocation} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50">
            {moving ? '이동 중...' : isSameLocation ? '현재 위치입니다' : `${files.length > 1 ? `${files.length}개 ` : ''}이동하기`}
          </Button>
        </div>
      </div>
    </div>
  )
}
