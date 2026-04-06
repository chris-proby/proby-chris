'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { DashboardWidget } from '@/lib/types'
import { Plus, Pencil, X, ExternalLink, Image, Loader2, Search, Tag, ChevronDown, ArrowUpDown, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WidgetGridProps {
  widgets: DashboardWidget[]
  companyId: string
  isSuperAdmin: boolean
}

type SortKey = 'order' | 'title_asc' | 'title_desc' | 'newest'

// ─── Tag input chip ───────────────────────────────────────────────────────────

function TagChipInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase()
    if (!tag || tags.includes(tag)) { setInput(''); return }
    onChange([...tags, tag])
    setInput('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div className="min-h-9 px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 focus-within:border-indigo-500 flex flex-wrap gap-1.5 transition-colors">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs">
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="hover:text-white transition-colors">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input) }
          if (e.key === 'Backspace' && !input && tags.length) removeTag(tags[tags.length - 1])
        }}
        onBlur={() => { if (input.trim()) addTag(input) }}
        placeholder={tags.length === 0 ? '태그 입력 후 Enter' : ''}
        className="flex-1 min-w-20 bg-transparent text-white text-sm placeholder:text-zinc-500 focus:outline-none"
      />
    </div>
  )
}

// ─── Widget modal ─────────────────────────────────────────────────────────────

interface WidgetModalProps {
  widget: DashboardWidget | null
  onClose: () => void
  onSaved: (widget: DashboardWidget) => void
  companyId: string
  nextOrder: number
}

function WidgetModal({ widget, onClose, onSaved, companyId, nextOrder }: WidgetModalProps) {
  const [title, setTitle] = useState(widget?.title ?? '')
  const [description, setDescription] = useState(widget?.description ?? '')
  const [thumbnailUrl, setThumbnailUrl] = useState(widget?.thumbnail_url ?? '')
  const [redirectUrl, setRedirectUrl] = useState(widget?.redirect_url ?? '')
  const [tags, setTags] = useState<string[]>(widget?.tags ?? [])
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [uploadingThumb, setUploadingThumb] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const thumbInputRef = useRef<HTMLInputElement>(null)
  // Skip auto-fetch on initial mount when editing existing widget
  const hasInitialized = useRef(false)
  // Track current thumbnailUrl in closure to prevent stale-read in setTimeout
  const thumbnailUrlRef = useRef(thumbnailUrl)
  useEffect(() => { thumbnailUrlRef.current = thumbnailUrl }, [thumbnailUrl])

  useEffect(() => {
    // On first render: skip auto-fetch if editing (widget already has redirect_url)
    if (!hasInitialized.current) {
      hasInitialized.current = true
      if (widget) return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    let valid = false
    try { new URL(redirectUrl); valid = true } catch { /* ignore */ }
    if (!valid) return

    debounceRef.current = setTimeout(async () => {
      setFetching(true)
      try {
        const res = await fetch(`/api/og-preview?url=${encodeURIComponent(redirectUrl)}`)
        if (!res.ok) return
        const data = await res.json()
        // Only overwrite thumbnail if it's currently empty (don't clobber uploaded/existing images)
        if (data.image && !thumbnailUrlRef.current) setThumbnailUrl(data.image)
        if (data.title && !title) setTitle(data.title)
        if (data.description && !description) setDescription(data.description)
        if (data.keywords?.length && tags.length === 0) setTags(data.keywords)
      } catch { /* ignore */ } finally {
        setFetching(false)
      }
    }, 800)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirectUrl])

  async function handleThumbUpload(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('이미지 파일만 업로드할 수 있습니다'); return }
    setUploadingThumb(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('로그인이 필요합니다'); return }

      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${companyId}/thumbnails/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage.from('files').upload(path, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })
      if (uploadError) throw uploadError

      const { data: urlData, error: urlError } = await supabase.storage.from('files').createSignedUrl(path, 315360000)
      if (urlError || !urlData?.signedUrl) throw (urlError ?? new Error('URL 생성 실패'))

      setThumbnailUrl(urlData.signedUrl)
      toast.success('이미지가 업로드됐습니다')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '업로드 실패')
    } finally {
      setUploadingThumb(false)
      if (thumbInputRef.current) thumbInputRef.current.value = ''
    }
  }

  async function handleSave() {
    if (!redirectUrl.trim()) { toast.error('URL을 입력해주세요'); return }
    setSaving(true)

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        thumbnail_url: thumbnailUrl.trim() || null,
        redirect_url: redirectUrl.trim(),
        tags,
      }

      let res: Response
      if (widget) {
        res = await fetch(`/api/widgets/${widget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/widgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: companyId, display_order: nextOrder, ...payload }),
        })
      }

      if (!res.ok) { toast.error((await res.json()).error ?? '저장 실패'); return }
      toast.success(widget ? '위젯이 수정됐습니다' : '위젯이 추가됐습니다')
      onSaved(await res.json())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-white font-semibold">{widget ? '위젯 수정' : '위젯 추가'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Redirect URL (first — triggers auto-fill) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-400">리디렉션 URL</label>
              {fetching && (
                <span className="flex items-center gap-1 text-xs text-indigo-400">
                  <Loader2 className="w-3 h-3 animate-spin" />메타 추출 중...
                </span>
              )}
            </div>
            <input
              type="url"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-xs text-zinc-600 mt-1">URL 입력 시 페이지 메타(og)로 자동 추출 · 막힌 사이트는 Microlink로 보강</p>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1.5">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="위젯 제목"
              className="w-full h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1.5">설명 <span className="text-zinc-600">(선택)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="위젯 설명"
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1.5">태그 <span className="text-zinc-600">(필터링에 사용)</span></label>
            <TagChipInput tags={tags} onChange={setTags} />
          </div>

          {/* Thumbnail */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-400">썸네일 이미지 <span className="text-zinc-600">(선택)</span></label>
              <button
                type="button"
                onClick={() => thumbInputRef.current?.click()}
                disabled={uploadingThumb}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
              >
                {uploadingThumb ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {uploadingThumb ? '업로드 중...' : '이미지 업로드'}
              </button>
            </div>
            <input
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="자동 추출되거나 직접 입력 / 업로드"
              className="w-full h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <input
              ref={thumbInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleThumbUpload(f) }}
            />
          </div>

          {thumbnailUrl && (
            <div className="rounded-xl overflow-hidden aspect-video bg-zinc-800">
              <img
                src={thumbnailUrl}
                alt="미리보기"
                className="w-full h-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-zinc-800 shrink-0">
          <button onClick={onClose} className="flex-1 h-9 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 text-sm transition-colors">
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'order', label: '기본 순서' },
  { key: 'title_asc', label: '제목 ↑' },
  { key: 'title_desc', label: '제목 ↓' },
  { key: 'newest', label: '최신 순' },
]

function SortDropdown({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = SORT_OPTIONS.find((o) => o.key === value)!

  useEffect(() => {
    function onClick(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 text-xs transition-colors"
      >
        <ArrowUpDown className="w-3 h-3 text-zinc-500" />
        {current.label}
        <ChevronDown className="w-3 h-3 text-zinc-500" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { onChange(opt.key); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${opt.key === value ? 'text-indigo-400 bg-indigo-600/10' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WidgetGrid({ widgets: initialWidgets, companyId, isSuperAdmin }: WidgetGridProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(initialWidgets)
  const [modalWidget, setModalWidget] = useState<DashboardWidget | null | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('order')

  // All unique tags across widgets
  const allTags = useMemo(() => {
    const set = new Set<string>()
    widgets.forEach((w) => w.tags?.forEach((t) => set.add(t)))
    return [...set].sort()
  }, [widgets])

  // Filtered + sorted
  const filtered = useMemo(() => {
    let result = widgets.filter((w) => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        w.title.toLowerCase().includes(q) ||
        w.description?.toLowerCase().includes(q) ||
        w.tags?.some((t) => t.toLowerCase().includes(q))
      const matchTag = !selectedTag || w.tags?.includes(selectedTag)
      return matchSearch && matchTag
    })

    result = [...result].sort((a, b) => {
      if (sortBy === 'title_asc') return a.title.localeCompare(b.title, 'ko')
      if (sortBy === 'title_desc') return b.title.localeCompare(a.title, 'ko')
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return a.display_order - b.display_order
    })

    return result
  }, [widgets, search, selectedTag, sortBy])

  function handleSaved(saved: DashboardWidget) {
    setWidgets((prev) => {
      const exists = prev.find((w) => w.id === saved.id)
      return exists ? prev.map((w) => w.id === saved.id ? saved : w) : [...prev, saved]
    })
    setModalWidget(undefined)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/widgets/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('삭제 실패'); return }
      setWidgets((prev) => prev.filter((w) => w.id !== id))
      toast.success('위젯이 삭제됐습니다')
    } finally {
      setDeletingId(null)
    }
  }

  const hasFilters = search || selectedTag

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 max-w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="제목, 설명, 태그 검색..."
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex-1" />

          {/* Sort */}
          <SortDropdown value={sortBy} onChange={setSortBy} />

          {/* Add widget (admin only) */}
          {isSuperAdmin && (
            <button
              onClick={() => setModalWidget(null)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />위젯 추가
            </button>
          )}
        </div>

        {/* Tag filter pills */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${!selectedTag ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
            >
              전체
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selectedTag === tag ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Grid / Empty state ── */}
      {widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-48 text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center">
            <Image className="w-6 h-6 text-zinc-500" />
          </div>
          <div>
            <p className="text-white font-medium">위젯이 없습니다</p>
            {isSuperAdmin && <p className="text-zinc-500 text-sm mt-1">위젯 추가 버튼으로 첫 위젯을 만들어보세요</p>}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-48 text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center">
            <Search className="w-6 h-6 text-zinc-500" />
          </div>
          <div>
            <p className="text-white font-medium">검색 결과가 없습니다</p>
            <p className="text-zinc-500 text-sm mt-1">다른 키워드나 태그로 검색해보세요</p>
          </div>
          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setSelectedTag(null) }}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              필터 초기화
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((widget) => (
            <div key={widget.id} className="group relative flex flex-col">
              {/* Admin edit/delete buttons */}
              {isSuperAdmin && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={() => setModalWidget(widget)}
                    className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 backdrop-blur-sm transition-colors"
                    title="수정"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(widget.id)}
                    disabled={deletingId === widget.id}
                    className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/50 backdrop-blur-sm transition-colors disabled:opacity-50"
                    title="삭제"
                  >
                    {deletingId === widget.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}

              <a
                href={widget.redirect_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col flex-1 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all hover:shadow-lg hover:shadow-black/30 group/card"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-zinc-800 overflow-hidden shrink-0">
                  {widget.thumbnail_url ? (
                    <img
                      src={widget.thumbnail_url}
                      alt={widget.title}
                      className="w-full h-full object-contain group-hover/card:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ExternalLink className="w-8 h-8 text-zinc-600 group-hover/card:text-zinc-500 transition-colors" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="px-3 py-2.5 bg-zinc-900 flex flex-col gap-1.5 flex-1">
                  <p className="text-sm text-white font-medium line-clamp-2 leading-snug">{widget.title}</p>
                  {widget.description && (
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{widget.description}</p>
                  )}
                  {widget.tags && widget.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {widget.tags.slice(0, 3).map((tag) => (
                        <button
                          key={tag}
                          onClick={(e) => { e.preventDefault(); setSelectedTag(selectedTag === tag ? null : tag) }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${selectedTag === tag ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-indigo-300 hover:bg-indigo-600/20'}`}
                        >
                          {tag}
                        </button>
                      ))}
                      {widget.tags.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] text-zinc-600">+{widget.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </a>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {modalWidget !== undefined && (
        <WidgetModal
          widget={modalWidget}
          companyId={companyId}
          nextOrder={widgets.length}
          onClose={() => setModalWidget(undefined)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
