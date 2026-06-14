import { ImageResponse } from "next/og";

export const alt = "CompanyRadar - 나만의 회사 지원 플랫폼";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COMPANIES = [
  { name: "당근마켓", fit: 92, color: "#4ade80", label: "지원 예정" },
  { name: "토스", fit: 78, color: "#38bdf8", label: "검토 중" },
  { name: "배달의민족", fit: 65, color: "#fb923c", label: "공고 확인" },
] as const;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(150deg, #0f172a 0%, #0c1f3d 55%, #0f172a 100%)",
          fontFamily: "Arial, sans-serif",
          alignItems: "center",
          padding: "60px 72px",
          gap: 52,
        }}
      >
        {/* ── Left: text ── */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 40 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                background: "#38bdf8",
                borderRadius: 11,
                fontSize: 24,
                fontWeight: 900,
                color: "#0f172a",
              }}
            >
              R
            </div>
            <span style={{ color: "#64748b", fontSize: 24, fontWeight: 700, display: "flex" }}>
              CompanyRadar
            </span>
          </div>

          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  color: "#ffffff",
                  fontSize: 64,
                  fontWeight: 900,
                  lineHeight: 1.1,
                  display: "flex",
                }}
              >
                지원할 회사를
              </span>
              <div style={{ display: "flex", gap: 0, alignItems: "baseline" }}>
                <span
                  style={{
                    color: "#38bdf8",
                    fontSize: 64,
                    fontWeight: 900,
                    lineHeight: 1.1,
                    display: "flex",
                  }}
                >
                  기준 있게&nbsp;
                </span>
                <span
                  style={{
                    color: "#ffffff",
                    fontSize: 64,
                    fontWeight: 900,
                    lineHeight: 1.1,
                    display: "flex",
                  }}
                >
                  정리하세요
                </span>
              </div>
            </div>
            <span style={{ color: "#475569", fontSize: 24, lineHeight: 1.5, display: "flex" }}>
              회사핏 점수 · 리스크 분석 · 면접 준비를 한 화면에서
            </span>
          </div>

          {/* Feature pills */}
          <div style={{ display: "flex", gap: 12 }}>
            {["핏 점수 자동 계산", "지원 일정 관리", "AI 전략 코치"].map((text) => (
              <div
                key={text}
                style={{
                  display: "flex",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.11)",
                  borderRadius: 999,
                  padding: "10px 22px",
                  fontSize: 20,
                  color: "#94a3b8",
                  fontWeight: 600,
                }}
              >
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: product card ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 408,
            gap: 14,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 24,
            padding: 28,
          }}
        >
          {/* Card header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ color: "#e2e8f0", fontSize: 20, fontWeight: 700, display: "flex" }}>
              이번 주 후보
            </span>
            <div
              style={{
                display: "flex",
                background: "rgba(74,222,128,0.1)",
                border: "1px solid rgba(74,222,128,0.25)",
                borderRadius: 999,
                padding: "5px 14px",
              }}
            >
              <span style={{ color: "#4ade80", fontSize: 16, fontWeight: 700, display: "flex" }}>
                3개 지원 예정
              </span>
            </div>
          </div>

          {/* Company rows */}
          {COMPANIES.map(({ name, fit, color, label }) => (
            <div
              key={name}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 14,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 700, display: "flex" }}>
                    {name}
                  </span>
                  <span style={{ color: "#475569", fontSize: 14, fontWeight: 500, display: "flex" }}>
                    {label}
                  </span>
                </div>
                <span style={{ color, fontSize: 36, fontWeight: 900, display: "flex" }}>{fit}</span>
              </div>
              {/* Score bar */}
              <div
                style={{
                  display: "flex",
                  background: "rgba(255,255,255,0.07)",
                  borderRadius: 999,
                  height: 7,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    background: color,
                    width: `${fit}%`,
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
