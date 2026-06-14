import { ImageResponse } from "next/og";

export const alt = "CompanyRadar - 나만의 회사 지원 플랫폼";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "#f8fafc",
          color: "#0f172a",
          display: "flex",
          fontFamily: "Arial, sans-serif",
          height: "100%",
          justifyContent: "space-between",
          padding: 72,
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 560 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div
              style={{
                alignItems: "center",
                background: "#0f172a",
                borderRadius: 999,
                color: "#ffffff",
                display: "flex",
                fontSize: 26,
                fontWeight: 700,
                height: 56,
                justifyContent: "center",
                letterSpacing: 0,
                width: 220,
              }}
            >
              CompanyRadar
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <h1 style={{ fontSize: 70, letterSpacing: 0, lineHeight: 1.05, margin: 0 }}>
                지원할 회사를
                <br />
                기준 있게 정리하세요
              </h1>
              <p style={{ color: "#475569", fontSize: 30, lineHeight: 1.35, margin: 0 }}>
                회사핏 점수, 리스크, 면접 준비 기록을 한 화면에서 관리하는 개인용 지원 트래커
              </p>
            </div>
          </div>
          <div style={{ color: "#0284c7", display: "flex", fontSize: 24, fontWeight: 700, gap: 18 }}>
            <span>회사 평가</span>
            <span>•</span>
            <span>지원 일정</span>
            <span>•</span>
            <span>면접 준비</span>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 24,
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.14)",
            display: "flex",
            flexDirection: "column",
            gap: 22,
            padding: 30,
            width: 420,
          }}
        >
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b", fontSize: 22, fontWeight: 700 }}>오늘의 후보</span>
            <span style={{ background: "#dcfce7", borderRadius: 999, color: "#15803d", fontSize: 20, padding: "8px 14px" }}>
              자동 저장됨
            </span>
          </div>
          {[
            ["High fit", "92", "#16a34a", "지원 예정"],
            ["Validate", "78", "#0284c7", "공고 재확인"],
            ["Watch", "64", "#d97706", "리스크 확인"],
          ].map(([label, score, color, status]) => (
            <div
              key={label}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 18,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                padding: 20,
              }}
            >
              <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 28, fontWeight: 800 }}>{label}</span>
                <span style={{ color, fontSize: 34, fontWeight: 900 }}>{score}</span>
              </div>
              <div style={{ background: "#e2e8f0", borderRadius: 999, display: "flex", height: 12, overflow: "hidden" }}>
                <div style={{ background: color, borderRadius: 999, width: `${score}%` }} />
              </div>
              <span style={{ color: "#64748b", fontSize: 20, fontWeight: 700 }}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
