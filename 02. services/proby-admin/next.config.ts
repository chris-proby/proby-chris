import type { NextConfig } from "next";

// Supabase WebSocket URL (와일드카드 ws:/wss: 대신 특정 호스트만 허용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWss = supabaseUrl ? supabaseUrl.replace(/^https?:\/\//, "wss://") : "";
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // 클릭재킹 방지 — iframe 임베드 허용 (Proby U-module 연동)
          { key: "X-Frame-Options", value: "ALLOWALL" },
          // MIME 스니핑 방지
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer 정보 최소화
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // DNS prefetch 비활성화
          { key: "X-DNS-Prefetch-Control", value: "off" },
          // 권한 정책 (마이크/카메라 접근 차단)
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // XSS 방지 헤더
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // HTTPS 강제 (프로덕션)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Content Security Policy (admin 앱용)
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 개발 모드에서만 unsafe-eval 허용 (React devtools용), 프로덕션 제거
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://cdn.mxpnl.com`,
              // Supabase + Mixpanel (와일드카드 ws: 제거 → Supabase WSS만 허용)
              `connect-src 'self' ${supabaseUrl} ${supabaseWss} https://api.mixpanel.com https://api-js.mixpanel.com`,
              // 이미지: Supabase storage, data URI
              `img-src 'self' data: blob: ${supabaseUrl}`,
              // 스타일 허용
              "style-src 'self' 'unsafe-inline'",
              // 폰트
              "font-src 'self' data:",
              // iframe 임베드 허용 (Proby 내부 툴용)
              "frame-ancestors *",
              // Office Online 미리보기 허용 (file preview용)
              "frame-src 'self' https://view.officeapps.live.com",
              // 미디어 허용 (영상/음성 파일 프리뷰)
              `media-src 'self' blob: ${supabaseUrl}`,
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
