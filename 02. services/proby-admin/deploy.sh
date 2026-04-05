#!/bin/bash
# proby-admin 배포 스크립트
# 사용법: ./deploy.sh "커밋 메시지"

set -e

MSG=${1:-"chore: deploy"}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "📦 변경사항 커밋 및 GitHub 푸시..."
cd "$SCRIPT_DIR"
git add -A
git commit -m "$MSG" 2>/dev/null || echo "커밋할 변경사항 없음"
git push origin master

echo "🚀 Vercel 프로덕션 배포..."
npx vercel --prod

echo "✅ 배포 완료!"
