'use client'
import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Company } from '@/lib/types'
import { toast } from 'sonner'
import { X, Building2, Upload, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { extractColorsFromImage } from '@/lib/color-utils'

interface EditCompanyModalProps {
  company: Company
  onClose: () => void
  onUpdated: (updated: Company) => void
}

export default function EditCompanyModal({ company, onClose, onUpdated }: EditCompanyModalProps) {
  const [name, setName] = useState(company.name)
  const [slug, setSlug] = useState(company.slug)
  const [primaryColor, setPrimaryColor] = useState(company.primary_color)
  const [secondaryColor, setSecondaryColor] = useState(company.secondary_color)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(company.logo_url)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [palette, setPalette] = useState<string[]>([])
  const [extracting, setExtracting] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLogoChange = useCallback((file: File) => {
    setLogoFile(file)
    setRemoveLogo(false)
    const url = URL.createObjectURL(file)
    setLogoPreview(url)
    setPalette([])
    setExtracting(true)
    const img = new Image()
    img.onload = () => {
      try {
        const colors = extractColorsFromImage(img)
        setPalette(colors.swatches)
        setPrimaryColor(colors.primary)
        setSecondaryColor(colors.secondary)
      } catch { /* ignore */ }
      setExtracting(false)
    }
    img.onerror = () => setExtracting(false)
    img.src = url
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    setLoading(true)
    const supabase = createClient()

    let logo_url: string | null | undefined = undefined

    if (removeLogo) {
      logo_url = null
    } else if (logoFile) {
      const ext = logoFile.name.split('.').pop() ?? 'png'
      const path = `${slug}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('logos').upload(path, logoFile, { upsert: true, contentType: logoFile.type })
      if (uploadError) { toast.error('로고 업로드 실패', { description: uploadError.message }); setLoading(false); return }
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      logo_url = data.publicUrl
    }

    const update: Partial<Company> = {
      name: name.trim(),
      slug: slug.trim(),
      primary_color: primaryColor,
      secondary_color: secondaryColor,
    }
    if (logo_url !== undefined) update.logo_url = logo_url

    const { data, error } = await supabase.from('companies').update(update).eq('id', company.id).select().single()
    if (error) { toast.error('저장 실패', { description: error.message }); setLoading(false); return }
    toast.success(`"${name.trim()}" 정보가 업데이트됐습니다`)
    onUpdated(data as Company)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />고객사 정보 수정
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-5">
          {/* 로고 */}
          <div className="space-y-2">
            <Label className="text-zinc-300 text-sm">로고 이미지</Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative border-2 border-dashed border-zinc-700 rounded-xl p-5 cursor-pointer hover:border-zinc-600 hover:bg-zinc-800/30 transition-colors"
            >
              {logoPreview && !removeLogo ? (
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0 border border-zinc-700">
                    <img src={logoPreview} alt="logo preview" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-300 text-sm font-medium truncate">{logoFile?.name ?? '현재 로고'}</p>
                    {logoFile && <p className="text-zinc-500 text-xs mt-0.5">{(logoFile.size / 1024).toFixed(0)} KB</p>}
                    {extracting && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                        <span className="text-xs text-indigo-400">색상 추출 중...</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setLogoFile(null); setLogoPreview(null); setRemoveLogo(true); setPalette([]) }}
                    className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-colors"
                    title="로고 제거"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-2">
                  <Upload className="w-7 h-7 text-zinc-600" />
                  <p className="text-zinc-400 text-sm">{removeLogo ? '로고가 제거됩니다' : '클릭하여 새 로고 업로드'}</p>
                  <p className="text-zinc-600 text-xs">PNG, JPG, SVG, WebP (최대 5MB)</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogoChange(e.target.files[0])} />
            </div>
          </div>

          {/* 추출된 팔레트 */}
          {palette.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                <Label className="text-zinc-300 text-sm">추출된 컬러 팔레트</Label>
                <span className="text-zinc-600 text-xs">클릭하여 적용</span>
              </div>
              <div className="flex gap-2 flex-wrap pb-1">
                {palette.map((color, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { if (i === 0) setPrimaryColor(color); else setSecondaryColor(color) }}
                    className="group relative"
                    title={color}
                  >
                    <div className="w-10 h-10 rounded-lg border-2 border-zinc-700 hover:border-white transition-colors shadow-sm" style={{ backgroundColor: color }} />
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-zinc-500 group-hover:text-zinc-300 whitespace-nowrap">{color}</div>
                  </button>
                ))}
              </div>
              <div className="h-3" />
            </div>
          )}

          {/* 이름 */}
          <div className="space-y-2">
            <Label className="text-zinc-300 text-sm">고객사 이름</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500" />
          </div>

          {/* 슬러그 */}
          <div className="space-y-2">
            <Label className="text-zinc-300 text-sm">슬러그 (URL 식별자)</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500 font-mono text-sm" />
          </div>

          {/* 브랜드 컬러 */}
          <div className="space-y-3">
            <Label className="text-zinc-300 text-sm">브랜드 컬러</Label>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <p className="text-zinc-500 text-xs">메인 컬러</p>
                <div className="flex gap-2 items-center">
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-9 h-9 rounded-lg border border-zinc-700 cursor-pointer bg-zinc-800 p-0.5" />
                  <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 bg-zinc-800 border-zinc-700 text-white font-mono text-xs focus-visible:ring-indigo-500 h-9" />
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                <p className="text-zinc-500 text-xs">보조 컬러</p>
                <div className="flex gap-2 items-center">
                  <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-9 h-9 rounded-lg border border-zinc-700 cursor-pointer bg-zinc-800 p-0.5" />
                  <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="flex-1 bg-zinc-800 border-zinc-700 text-white font-mono text-xs focus-visible:ring-indigo-500 h-9" />
                </div>
              </div>
            </div>
            {/* 미리보기 */}
            <div className="rounded-xl overflow-hidden border border-zinc-700">
              <div className="h-10 flex items-center px-4 gap-3" style={{ background: `linear-gradient(135deg, ${primaryColor}22, ${secondaryColor}15)`, borderBottom: `1px solid ${primaryColor}30` }}>
                <div className="w-5 h-5 rounded-md" style={{ backgroundColor: primaryColor }} />
                <span className="text-white text-xs font-medium">{name || '고객사명'}</span>
                <div className="flex-1" />
                <div className="w-16 h-5 rounded-md text-[9px] flex items-center justify-center text-white font-bold" style={{ backgroundColor: primaryColor }}>Upload</div>
              </div>
              <div className="flex gap-2 p-3 bg-zinc-950">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex-1 aspect-square rounded-lg" style={{ backgroundColor: i === 0 ? primaryColor + '20' : i === 1 ? secondaryColor + '15' : '#27272a' }} />
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white">취소</Button>
            <Button type="submit" disabled={!name.trim() || !slug.trim() || loading} className="flex-1 text-white" style={{ backgroundColor: primaryColor }}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />저장 중...</> : '저장하기'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
