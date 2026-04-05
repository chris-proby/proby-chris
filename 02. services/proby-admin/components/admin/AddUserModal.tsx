'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Company } from '@/lib/types'
import { toast } from 'sonner'
import { X, UserPlus, Loader2, Eye, EyeOff, ChevronDown } from 'lucide-react'

interface AddUserModalProps {
  companies: Company[]
  onClose: () => void
  onCreated: () => void
}

export default function AddUserModal({ companies, onClose, onCreated }: AddUserModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    if (password.length < 6) { toast.error('비밀번호는 최소 6자 이상이어야 합니다'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, companyId: companyId || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error('유저 생성 실패', { description: data.error })
        return
      }
      toast.success(`${email} 유저가 생성됐습니다`)
      onCreated()
    } catch {
      toast.error('네트워크 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-400" />유저 추가
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-sm">이메일 <span className="text-red-400">*</span></Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
              autoFocus
              required
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-sm">비밀번호 <span className="text-red-400">*</span></Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="최소 6자"
                required
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-sm">이름 <span className="text-zinc-600 font-normal">(선택)</span></Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="홍길동"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-sm">회사 배정 <span className="text-zinc-600 font-normal">(선택)</span></Label>
            <div className="relative">
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="appearance-none w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">미배정</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white">
              취소
            </Button>
            <Button type="submit" disabled={!email.trim() || !password || loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />생성 중...</> : '유저 추가'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
