import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | Company Signal",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">개인정보 처리방침</h1>
      <p className="mb-8 text-sm text-slate-400">최종 업데이트: 2026년 6월</p>

      <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-700">
        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">1. 수집하는 개인정보</h2>
          <p>Company Signal은 서비스 제공을 위해 아래와 같은 정보를 수집합니다.</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>이메일 주소 (회원가입 및 로그인 목적)</li>
            <li>이용자가 직접 입력한 회사/공고 데이터, 지원 상태, 면접 기록</li>
            <li>서비스 문의, 환불 요청, 회원탈퇴 요청 내용</li>
            <li>AI 크레딧 사용량, 결제 승인 상태, 결제 식별자</li>
            <li>서비스 이용 기록 (오류 추적 목적)</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">2. 개인정보의 이용 목적</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>회원 인증 및 서비스 제공</li>
            <li>AI 크레딧 지급, 사용량 차감, 결제/환불 처리</li>
            <li>서비스 개선 및 오류 수정</li>
            <li>이용자 문의 응답</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">3. 개인정보의 보관 및 파기</h2>
          <p>
            수집된 개인정보는 이용자가 회원탈퇴를 요청하고 운영자가 처리할 때까지 보관합니다.
            결제, 환불, 분쟁 대응 등 관련 법령에서 보관 의무를 정한 정보는 필요한 기간 동안
            보관할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">4. 제3자 제공</h2>
          <p>
            이용자의 개인정보는 법령에서 요구하는 경우를 제외하고 제3자에게 제공하지 않습니다.
            단, AI 분석 기능 이용 시 입력 데이터가 AI API 제공사(OpenAI)로 전송될 수 있으며,
            결제 처리 시 결제 식별자와 승인 정보가 토스페이먼츠를 통해 처리될 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">5. 이용자의 권리</h2>
          <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>본인 데이터 조회 및 내보내기</li>
            <li>개인정보 수정</li>
            <li>계정 및 데이터 삭제 요청</li>
          </ul>
          <p className="mt-2">위 권리 행사는 설정 화면에서 직접 처리하거나 이메일로 문의해주세요.</p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">6. 쿠키 및 로컬 스토리지</h2>
          <p>
            서비스는 로그인 세션 유지를 위해 쿠키와 브라우저 로컬 스토리지를 사용합니다. 이용자는
            브라우저 설정에서 쿠키를 비활성화할 수 있으나, 이 경우 일부 기능이 제한될 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">7. 문의</h2>
          <p>
            개인정보 처리에 관한 문의는{" "}
            <a className="text-slate-900 underline" href="mailto:companysignal.app@gmail.com">
              companysignal.app@gmail.com
            </a>
            으로 연락해주세요.
          </p>
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
