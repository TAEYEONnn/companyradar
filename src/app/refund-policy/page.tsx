import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "환불 정책 | CompanyRadar",
};

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">환불 정책</h1>
      <p className="mb-8 text-sm text-slate-400">최종 업데이트: 2026년 6월</p>

      <div className="mb-8 rounded-md border border-sky-200 bg-sky-50 px-4 py-3">
        <p className="text-sm text-amber-700">
          CompanyRadar의 AI 기능은 유료 베타입니다. 계정당 첫 성공 5회는 무료이며, 이후
          AI 10회권을 구매해 사용할 수 있습니다.
        </p>
      </div>

      <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-700">
        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">1. 환불 가능 조건</h2>
          <p>
            AI 10회권은 결제 후 7일 이내이고 유료 크레딧을 사용하지 않은 경우 전액 환불을
            요청할 수 있습니다. 계정당 제공되는 무료 5회 체험은 환불 대상 결제가 아닙니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">2. 개별 검토 대상</h2>
          <p>아래 경우에는 결제/사용 이력을 확인한 뒤 개별적으로 안내합니다.</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>유료 크레딧을 일부 사용한 경우</li>
            <li>서비스 장애로 AI 결과를 정상적으로 받지 못한 경우</li>
            <li>중복 결제 또는 승인 오류가 의심되는 경우</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">3. 환불 문의</h2>
          <p>
            결제 또는 환불 관련 문의는 앱 설정의 결제 및 환불 섹션에서 접수하거나{" "}
            {process.env.NEXT_PUBLIC_SUPPORT_EMAIL ? (
              <a
                className="text-slate-900 underline"
                href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`}
              >
                {process.env.NEXT_PUBLIC_SUPPORT_EMAIL}
              </a>
            ) : (
              "이메일"
            )}
            으로 아래 내용을 포함해 연락해주세요.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>가입 이메일</li>
            <li>결제일 및 결제 수단</li>
            <li>환불 요청 사유</li>
          </ul>
        </section>
      </div>

      <div className="mt-10 border-t border-slate-100 pt-6">
        <Link className="text-sm text-slate-400 hover:text-slate-600" href="/">
          ← 홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
