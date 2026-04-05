'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Folder } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { X, Globe, Lock, Check, Users, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface CompanyUser {
  id: string
  full_name: string | null
  email: string
}

interface FolderPermissionModalProps {
  folder: Folder
  companyId: string
  onClose: () => void
}

export default function FolderPermissionModal({ folder, companyId, onClose }: FolderPermissionModalProps) {
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [allowedIds, setAllowedIds] = useState<Set<string>>(new Set())
  const [isRestricted, setIsRestricted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [usersRes, permsRes] = await Promise.all([
          fetch(`/api/admin/company-users/${companyId}`).then((r) => {
            if (!r.ok) throw new Error(`유저 목록 로드 실패 (${r.status})`)
            return r.json()
          }),
          createClient().from('folder_permissions').select('profile_id').eq('folder_id', folder.id),
        ])

        setUsers(usersRes.users ?? [])

        if (permsRes.data && permsRes.data.length > 0) {
          setIsRestricted(true)
          setAllowedIds(new Set(permsRes.data.map((p: { profile_id: string }) => p.profile_id)))
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '데이터 로드 실패')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [folder.id, companyId])

  function toggleUser(id: string) {
    setAllowedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase.from('folder_permissions').delete().eq('folder_id', folder.id)

      if (isRestricted && allowedIds.size > 0) {
        const rows = Array.from(allowedIds).map((profile_id) => ({ folder_id: folder.id, profile_id }))
        const { error } = await supabase.from('folder_permissions').insert(rows)
        if (error) throw error
      }

      toast.success('권한이 저장됐습니다')
      onClose()
    } catch {
      toast.error('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  function getInitial(u: CompanyUser) {
    return (u.full_name ?? u.email ?? '?').charAt(0).toUpperCase()
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">폴더 열람 권한</h2>
              <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-56">{folder.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Access type toggle */}
        <div className="p-5 border-b border-zinc-800 shrink-0">
          <p className="text-zinc-400 text-xs mb-3">열람 범위를 설정하세요</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setIsRestricted(false)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${!isRestricted ? 'border-emerald-500/50 bg-emerald-500/10 text-white' : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'}`}
            >
              <Globe className={`w-4 h-4 shrink-0 ${!isRestricted ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <div className="text-left">
                <p className="text-xs font-medium">전체 공개</p>
                <p className="text-[10px] text-zinc-500">회사 모든 유저</p>
              </div>
              {!isRestricted && <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
            </button>
            <button
              onClick={() => setIsRestricted(true)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${isRestricted ? 'border-indigo-500/50 bg-indigo-500/10 text-white' : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600'}`}
            >
              <Users className={`w-4 h-4 shrink-0 ${isRestricted ? 'text-indigo-400' : 'text-zinc-500'}`} />
              <div className="text-left">
                <p className="text-xs font-medium">특정 유저만</p>
                <p className="text-[10px] text-zinc-500">선택한 유저만</p>
              </div>
              {isRestricted && <Check className="w-3.5 h-3.5 text-indigo-400 ml-auto" />}
            </button>
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">이 회사에 등록된 유저가 없습니다</p>
          ) : (
            <div className="space-y-1">
              {users.map((u) => {
                const checked = !isRestricted || allowedIds.has(u.id)
                return (
                  <button
                    key={u.id}
                    onClick={() => isRestricted && toggleUser(u.id)}
                    disabled={!isRestricted}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${isRestricted ? 'hover:bg-zinc-800 cursor-pointer' : 'cursor-default'}`}
                  >
                    {/* Checkbox */}
                    <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-indigo-600 border-indigo-600' : isRestricted ? 'border-zinc-600 bg-transparent' : 'border-zinc-700 bg-zinc-800'}`}>
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </div>

                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold transition-colors ${checked ? 'bg-indigo-600/20 text-indigo-300' : 'bg-zinc-700 text-zinc-400'}`}>
                      {getInitial(u)}
                    </div>

                    {/* Name + Email */}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate transition-colors ${checked ? 'text-white' : 'text-zinc-300'}`}>
                        {u.full_name ?? '(이름 없음)'}
                      </p>
                      <p className="text-zinc-500 text-xs truncate">{u.email}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Warning when restricted but no user selected */}
        {isRestricted && allowedIds.size === 0 && !loading && (
          <div className="px-5 pb-2 shrink-0">
            <p className="text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              ⚠️ 유저를 한 명도 선택하지 않으면 모든 유저가 접근 불가합니다
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-5 border-t border-zinc-800 shrink-0">
          <span className="text-zinc-600 text-xs">
            {isRestricted ? `${allowedIds.size}명 선택됨` : `전체 ${users.length}명`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700">
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />저장 중...</> : '저장'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
