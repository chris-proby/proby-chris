'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Company } from '@/lib/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Building2, Shield, UserRound, UserPlus, Pencil } from 'lucide-react'
import { formatDate } from '@/lib/file-utils'
import AddUserModal from './AddUserModal'
import EditUserModal from './EditUserModal'
import { trackMixpanel } from '@/lib/analytics/mixpanel'

type UserRow = {
  id: string; email: string; full_name: string | null
  company_id: string | null; company_name: string | null
  is_super_admin: boolean; created_at: string
}

export default function AdminUserList({ users, companies }: { users: UserRow[]; companies: Company[] }) {
  const router = useRouter()
  const [showAddUser, setShowAddUser] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0">
        <h1 className="text-white font-semibold text-lg">유저 관리</h1>
        <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 border-zinc-700">{users.length}명</Badge>
        <div className="flex-1" />
        <Button size="sm" onClick={() => {
          setShowAddUser(true)
          trackMixpanel('Admin_User_Add_Button_Clicked', {})
        }} className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white">
          <UserPlus className="w-3.5 h-3.5 mr-1.5" />유저 추가
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">유저</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">가입일</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">회사</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">권한</th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {users.map((user) => {
                const initials = (user.full_name ?? user.email).split(/[\s@]/)[0].slice(0, 2).toUpperCase()
                return (
                  <tr key={user.id} className="hover:bg-zinc-800/50 transition-colors group">
                    {/* User info */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback className="text-xs font-semibold bg-indigo-600/20 text-indigo-400">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          {user.full_name && <p className="text-white text-sm font-medium truncate">{user.full_name}</p>}
                          <p className="text-zinc-400 text-xs truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Joined date */}
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-zinc-500 text-sm">{formatDate(user.created_at)}</span>
                    </td>

                    {/* Company */}
                    <td className="px-5 py-3.5">
                      {user.company_name ? (
                        <span className="flex items-center gap-1.5 text-zinc-300 text-sm">
                          <Building2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span className="truncate max-w-36">{user.company_name}</span>
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-sm">미배정</span>
                      )}
                    </td>

                    {/* Role badge */}
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      {user.is_super_admin ? (
                        <Badge className="bg-indigo-600/20 text-indigo-400 border-indigo-500/30 text-xs">
                          <Shield className="w-3 h-3 mr-1" />Super Admin
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-xs">
                          <UserRound className="w-3 h-3 mr-1" />일반 유저
                        </Badge>
                      )}
                    </td>

                    {/* Edit button */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => {
                          setEditingUser(user)
                          trackMixpanel('Admin_User_Edit_Button_Clicked', { target_user_id: user.id, target_email: user.email })
                        }}
                        className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-600 hover:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100"
                        title="유저 수정"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <UserRound className="w-10 h-10 text-zinc-600 mb-3" />
              <p className="text-zinc-400 mb-4">유저가 없습니다</p>
              <Button size="sm" onClick={() => setShowAddUser(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />첫 유저 추가
              </Button>
            </div>
          )}
        </div>
      </div>

      {showAddUser && (
        <AddUserModal
          companies={companies}
          onClose={() => setShowAddUser(false)}
          onCreated={() => {
            setShowAddUser(false)
            trackMixpanel('Admin_User_Created', {})
            router.refresh()
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          companies={companies}
          onClose={() => setEditingUser(null)}
          onUpdated={() => {
            trackMixpanel('Admin_User_Edited', { target_user_id: editingUser?.id, target_email: editingUser?.email })
            setEditingUser(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
