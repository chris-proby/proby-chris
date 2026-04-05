'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { X, FolderPlus } from 'lucide-react'

export default function NewFolderModal({ companyId, parentId, onClose, onCreated }: { companyId: string; parentId: string | null; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const supabase = createClient()
    const insertData: { company_id: string; name: string; parent_id: string | null } = { company_id: companyId, name: name.trim(), parent_id: parentId }
    const { error } = await supabase.from('folders').insert(insertData)
    if (error) { toast.error('폴더 생성 실패', { description: error.message }); setLoading(false); return }
    toast.success(`"${name.trim()}" 폴더가 생성됐습니다`)
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-white font-semibold flex items-center gap-2"><FolderPlus className="w-4 h-4 text-amber-400" />새 폴더 만들기</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-300 text-sm">폴더 이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="폴더 이름 입력" autoFocus className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white">취소</Button>
            <Button type="submit" disabled={!name.trim() || loading} className="flex-1 bg-amber-500 hover:bg-amber-400 text-white">
              {loading ? '생성 중...' : '만들기'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
