export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: { id: string; name: string; slug: string; logo_url: string | null; primary_color: string; secondary_color: string; credits: number; is_archived: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; slug: string; logo_url?: string | null; primary_color?: string; secondary_color?: string; credits?: number; is_archived?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; name?: string; slug?: string; logo_url?: string | null; primary_color?: string; secondary_color?: string; credits?: number; is_archived?: boolean; updated_at?: string }
        Relationships: []
      }
      folders: {
        Row: { id: string; company_id: string; parent_id: string | null; name: string; created_at: string; updated_at: string }
        Insert: { id?: string; company_id: string; parent_id?: string | null; name: string; created_at?: string; updated_at?: string }
        Update: { id?: string; name?: string; parent_id?: string | null; updated_at?: string }
        Relationships: []
      }
      files: {
        Row: { id: string; company_id: string; folder_id: string | null; name: string; original_name: string; file_type: string; file_size: number; storage_path: string; storage_bucket: string; description: string | null; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; company_id: string; folder_id?: string | null; name: string; original_name: string; file_type: string; file_size: number; storage_path: string; storage_bucket?: string; description?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; name?: string; folder_id?: string | null; description?: string | null; updated_at?: string }
        Relationships: []
      }
      profiles: {
        Row: { id: string; company_id: string | null; full_name: string | null; role: 'admin' | 'editor' | 'viewer'; is_super_admin: boolean; created_at: string; updated_at: string }
        Insert: { id: string; company_id?: string | null; full_name?: string | null; role?: 'admin' | 'editor' | 'viewer'; is_super_admin?: boolean; created_at?: string; updated_at?: string }
        Update: { company_id?: string | null; full_name?: string | null; role?: 'admin' | 'editor' | 'viewer'; is_super_admin?: boolean; updated_at?: string }
        Relationships: []
      }
      folder_permissions: {
        Row: { id: string; folder_id: string; profile_id: string; created_at: string }
        Insert: { id?: string; folder_id: string; profile_id: string; created_at?: string }
        Update: { folder_id?: string; profile_id?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Company = Database['public']['Tables']['companies']['Row']
export type Folder = Database['public']['Tables']['folders']['Row']
export type FileRecord = Database['public']['Tables']['files']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']

export interface FolderPermission {
  id: string
  folder_id: string
  profile_id: string
  created_at: string
}

export interface FolderWithPermissions extends Folder {
  allowedUserIds?: string[] // undefined = public (no restrictions)
}
