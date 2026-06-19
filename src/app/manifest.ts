import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CompanyRadar",
    short_name: "CompanyRadar",
    description: "채용공고와 내 경력을 근거로 비교하는 공고 핏 분석기",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ee",
    theme_color: "#0f172a",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
