export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function getFileIcon(fileType: string): 'video' | 'document' | 'image' | 'audio' | 'file' {
  if (fileType.startsWith('video/')) return 'video'
  if (fileType.startsWith('image/')) return 'image'
  if (fileType.startsWith('audio/')) return 'audio'
  if (fileType === 'application/pdf' || fileType.includes('word') || fileType.includes('document') || fileType === 'text/plain') return 'document'
  return 'file'
}

export function isVideoFile(fileType: string): boolean { return fileType.startsWith('video/') }
export function isPreviewable(fileType: string): boolean {
  return fileType.startsWith('video/') || fileType.startsWith('image/') || fileType.startsWith('audio/') ||
    fileType === 'application/pdf' || fileType.startsWith('text/') || fileType === 'application/json' ||
    fileType.includes('wordprocessingml') || fileType.includes('spreadsheetml') || fileType.includes('presentationml') ||
    fileType === 'application/msword' || fileType === 'application/vnd.ms-excel' || fileType === 'application/vnd.ms-powerpoint'
}
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}
