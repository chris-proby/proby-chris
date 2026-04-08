'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Company } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import AddCompanyModal from './AddCompanyModal'
import EditCompanyModal from './EditCompanyModal'
import { Building2, Plus, Search, Files, Coins, Check, Pencil, Settings2, Archive, ArchiveRestore, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { trackMixpanel } from '@/lib/analytics/mixpanel'

function CreditsEditor({ company, onUpdated }: { company: Company; onUpdated: (newCredits: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(company.credits ?? 0))
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setValue(String(company.credits ?? 0))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function save(e: React.MouseEvent | React.KeyboardEvent) {
    e.preventDefault()
    e.stopPropagation()
    const num = parseInt(value)
    if (isNaN(num) || num < 0) { toast.error('유효한 숫자를 입력하세요'); return }
    setSaving(true)
    const { error } = await createClient().from('companies').update({ credits: num }).eq('id', company.id)
    setSaving(false)
    if (error) { toast.error('저장 실패', { description: error.message }); return }
    trackMixpanel('Admin_Company_Credits_Updated', { company_id: company.id, company_name: company.name, old_credits: company.credits ?? 0, new_credits: num })
    toast.success(`${company.name} 크레딧: ${num}개`)
    setEditing(false)
    onUpdated(num)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
        <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <input
          ref={inputRef}
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(e); if (e.key === 'Escape') setEditing(false) }}
          className="w-20 h-6 px-1.5 text-xs bg-zinc-700 border border-amber-500/50 rounded text-white focus:outline-none focus:border-amber-400"
        />
        <button
          onClick={save}
          disabled={saving}
          className="p-0.5 rounded text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button onClick={startEdit} className="group/credit flex items-center gap-1.5 text-zinc-500 hover:text-amber-400 transition-colors">
      <Coins className="w-3.5 h-3.5 group-hover/credit:text-amber-400 transition-colors" />
      <span className="text-xs">{company.credits ?? 0} 크레딧</span>
      <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/credit:opacity-100 transition-opacity" />
    </button>
  )
}

export default function AdminCompanyList({ companies: initialCompanies, fileCounts }: { companies: Company[]; fileCounts: Record<string, number> }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [companies, setCompanies] = useState<Company[]>(initialCompanies)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  const active = companies.filter((c) => !c.is_archived && c.name.toLowerCase().includes(search.toLowerCase()))
  const archived = companies.filter((c) => c.is_archived && c.name.toLowerCase().includes(search.toLowerCase()))
  const filtered = showArchived ? archived : active

  function handleCreditsUpdated(companyId: string, newCredits: number) {
    setCompanies((prev) => prev.map((c) => c.id === companyId ? { ...c, credits: newCredits } : c))
  }

  function handleCompanyUpdated(updated: Company) {
    trackMixpanel('Admin_Company_Edited', { company_id: updated.id, company_name: updated.name })
    setCompanies((prev) => prev.map((c) => c.id === updated.id ? updated : c))
    setEditingCompany(null)
  }

  async function handleDuplicate(company: Company) {
    setDuplicatingId(company.id)
    try {
      const res = await fetch('/api/admin/duplicate-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '복제 실패')
      trackMixpanel('Admin_Company_Duplicated', { source_company_id: company.id, source_company_name: company.name, new_company_id: data.company?.id })
      toast.success(`"${company.name}" 복제 완료 → "${data.company?.name}"`)
      setCompanies((prev) => [...prev, data.company])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '복제 실패')
    } finally {
      setDuplicatingId(null)
    }
  }

  async function handleArchive(company: Company, restore = false) {
    if (!restore && confirmArchiveId !== company.id) {
      setConfirmArchiveId(company.id)
      trackMixpanel('Admin_Company_Archive_Confirm_Shown', { company_id: company.id, company_name: company.name })
      return
    }
    setArchivingId(company.id)
    setConfirmArchiveId(null)
    try {
      const res = await fetch('/api/admin/delete-company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id, restore }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '처리 실패')
      trackMixpanel(restore ? 'Admin_Company_Restored' : 'Admin_Company_Archived', { company_id: company.id, company_name: company.name })
      setCompanies((prev) => prev.map((c) => c.id === company.id ? { ...c, is_archived: !restore } : c))
      toast.success(restore ? `${company.name} 복원됐습니다` : `${company.name} 보관됐습니다`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '처리 실패')
    } finally {
      setArchivingId(null)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0">
        <h1 className="text-white font-semibold text-lg">고객사 관리</h1>
        <div className="flex-1" />
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${showArchived ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
        >
          <Archive className="w-3.5 h-3.5" />
          보관 {archived.length > 0 && <span className="ml-0.5">({archived.length})</span>}
        </button>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input placeholder="고객사 검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 w-48 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 text-sm focus-visible:ring-indigo-500" />
        </div>
        {!showArchived && (
          <Button size="sm" onClick={() => setShowAdd(true)} className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white">
            <Plus className="w-3.5 h-3.5 mr-1.5" />고객사 추가
          </Button>
        )}
      </div>
          <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-64 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-2">
              {showArchived ? <Archive className="w-7 h-7 text-zinc-500" /> : <Building2 className="w-7 h-7 text-zinc-500" />}
            </div>
            <div>
              <p className="text-white font-medium">{showArchived ? '보관된 고객사가 없습니다' : '고객사가 없습니다'}</p>
              <p className="text-zinc-500 text-sm mt-1">{showArchived ? '보관한 고객사가 여기 표시됩니다' : '고객사를 추가해 파일을 관리하세요'}</p>
            </div>
            {!showArchived && <Button onClick={() => setShowAdd(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white"><Plus className="w-4 h-4 mr-2" />고객사 추가</Button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((c) => (
              <div key={c.id} className={`group relative bg-zinc-900 border rounded-2xl transition-all ${showArchived ? 'border-zinc-700 opacity-70' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'}`}>
                {/* 수정 + 복제 버튼 (보관 중엔 숨김) */}
                {!showArchived && (
                  <>
                    {/* 복제 */}
                    <button
                      onClick={(e) => { e.preventDefault(); handleDuplicate(c) }}
                      disabled={duplicatingId === c.id}
                      className="absolute top-3 right-[4.5rem] p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/50 opacity-0 group-hover:opacity-100 transition-all z-10 disabled:opacity-50"
                      title="고객사 복제"
                    >
                      {duplicatingId === c.id
                        ? <span className="w-3.5 h-3.5 block border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    {/* 수정 */}
                    <button
                      onClick={() => {
                        setEditingCompany(c)
                        trackMixpanel('Admin_Company_Edit_Button_Clicked', { company_id: c.id, company_name: c.name })
                      }}
                      className="absolute top-3 right-10 p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-white hover:border-zinc-600 opacity-0 group-hover:opacity-100 transition-all z-10"
                      title="고객사 정보 수정"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {/* 보관 / 복원 버튼 */}
                <button
                  onClick={(e) => { e.preventDefault(); showArchived ? handleArchive(c, true) : handleArchive(c) }}
                  disabled={archivingId === c.id}
                  className={`absolute top-3 right-3 p-1.5 rounded-lg border opacity-0 group-hover:opacity-100 transition-all z-10 ${
                    confirmArchiveId === c.id
                      ? 'bg-amber-600 border-amber-500 text-white opacity-100'
                      : showArchived
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/50'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-amber-400 hover:border-amber-500/50'
                  }`}
                  title={confirmArchiveId === c.id ? '한 번 더 클릭하면 보관됩니다' : showArchived ? '복원' : '보관'}
                  onBlur={() => setConfirmArchiveId(null)}
                >
                  {archivingId === c.id
                    ? <span className="w-3.5 h-3.5 block border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : showArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />
                  }
                </button>
                <Link href={`/admin/${c.id}`} onClick={() => trackMixpanel('Admin_Company_Card_Clicked', { company_id: c.id, company_name: c.name, file_count: fileCounts[c.id] ?? 0 })} className="block p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: c.primary_color + '30', border: `1px solid ${c.primary_color}40` }}>
                      {c.logo_url ? <img src={c.logo_url} alt={c.name} className="w-7 h-7 object-contain" /> : <Building2 className="w-5 h-5" style={{ color: c.primary_color }} />}
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                      <h3 className="text-white font-semibold truncate group-hover:text-indigo-300 transition-colors">{c.name}</h3>
                      <p className="text-zinc-500 text-xs mt-0.5 truncate">{c.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <Files className="w-3.5 h-3.5" />
                      <span className="text-xs">{fileCounts[c.id] ?? 0}개 파일</span>
                    </div>
                    <CreditsEditor company={c} onUpdated={(n) => handleCreditsUpdated(c.id, n)} />
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
      {showAdd && <AddCompanyModal onClose={() => setShowAdd(false)} onCreated={() => {
        setShowAdd(false)
        trackMixpanel('Admin_Company_Created', {})
        router.refresh()
      }} />}
      {editingCompany && <EditCompanyModal company={editingCompany} onClose={() => setEditingCompany(null)} onUpdated={handleCompanyUpdated} />}
    </div>
  )
}
