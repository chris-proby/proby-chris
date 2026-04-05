#!/bin/bash
# 로컬 개발 서버 시작 스크립트
# .env.local에서 환경변수를 읽어 vercel dev에 주입합니다

set -a  # 모든 변수를 자동 export
# 주석과 빈 줄을 제외하고 .env.local 로드
while IFS='=' read -r key val; do
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
  export "$key"="$val"
done < .env.local
set +a

echo "✓ 환경변수 로드 완료"
echo "  SUPABASE_URL: ${SUPABASE_URL:0:30}..."
echo "  SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
echo ""

exec vercel dev --listen 3000
