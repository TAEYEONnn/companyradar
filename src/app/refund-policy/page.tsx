import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "환불 정책 | Company Signal",
};

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">환불 정책</h1>
      <p className="mb-8 text-sm text-slate-400">최종 업데이트: 2026년 6월</p>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 mb-8">
        <p className="text-sm text-amber-700">
          현재 Company Signal은 정식 유료 결제 기능을 제공하지 않습니다. 결제 기능이 도입되면 본
          환불 정책이 업데이트됩니다.
        </p>
      </div>

      <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-700">
        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">1. 현재 결제 상태</h2>
          <p>
            Company Signal은 현재 무료로 제공됩니다. 별도의 결제가 발생하지 않으므로 환불 대상
            거래가 없습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">2. 향후 유료 기능 도입 시 환불 원칙</h2>
          <p>유료 기능이 도입될 경우 아래 원칙을 적용할 예정입니다.</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>결제 후 7일 이내 미사용 상태라면 전액 환불 요청 가능</li>
            <li>구독형 서비스는 남은 기간에 비례한 부분 환불 검토</li>
            <li>이용 내역이 있는 경우 환불 여부는 개별 검토</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">3. 환불 문의</h2>
          <p>
            결제 또는 환불 관련 문의가 있다면{" "}
            <a className="text-slate-900 underline" href="mailto:companysignal.app@gmail.com">
              companysignal.app@gmail.com
            </a>
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
