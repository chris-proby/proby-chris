import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // 클릭재킹 방지
          { key: "X-Frame-Options", value: "DENY" },
          // MIME 스니핑 방지
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer 정보 최소화
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // DNS prefetch 비활성화
          { key: "X-DNS-Prefetch-Control", value: "on" },
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
              // Next.js 인라인 스크립트 허용
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Supabase + 외부 스토리지 허용
              `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "*"} wss:`,
              // 이미지: Supabase storage, data URI
              `img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "*"}`,
              // 스타일 허용
              "style-src 'self' 'unsafe-inline'",
              // 폰트
              "font-src 'self' data:",
              // iframe 차단 (클릭재킹 이중 방어)
              "frame-ancestors 'none'",
              // Office Online 미리보기 허용 (file preview용)
              "frame-src 'self' https://view.officeapps.live.com",
              // 미디어 허용 (영상/음성 파일 프리뷰)
              `media-src 'self' blob: ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "*"}`,
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
