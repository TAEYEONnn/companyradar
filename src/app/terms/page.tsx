import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이용약관 | CompanyRadar",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">이용약관</h1>
      <p className="mb-8 text-sm text-slate-400">최종 업데이트: 2026년 6월</p>

      <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-700">
        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">제1조 (목적)</h2>
          <p>
            본 약관은 CompanyRadar(이하 &quot;서비스&quot;)을 이용함에 있어 서비스 제공자와
            이용자 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">제2조 (서비스 이용)</h2>
          <p>
            본 서비스는 이직/취업 준비 중인 개인 이용자를 대상으로 회사 정보 트래킹, 지원 상태
            관리, AI 전략 제안 기능을 제공합니다. AI 기능은 유료 베타로 운영될 수 있으며,
            계정당 첫 성공 1회 무료 체험을 제공합니다.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>이용자는 본인의 계정을 타인과 공유하거나 양도할 수 없습니다.</li>
            <li>서비스를 상업적 목적으로 무단 활용하는 행위를 금지합니다.</li>
            <li>서비스 내 기능을 자동화된 방식으로 비정상적으로 이용하는 행위를 금지합니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">제3조 (계정 및 데이터)</h2>
          <p>
            이용자가 서비스에 입력한 데이터는 이용자 본인 소유이며, 서비스 제공자는 법령에서
            요구하는 경우 외에는 이를 제3자에게 제공하지 않습니다. 이용자는 설정 화면에서 데이터를
            내보낼 수 있고, 회원탈퇴 요청을 접수할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">제4조 (AI 크레딧 및 결제)</h2>
          <p>
            AI 10회권은 성공한 AI 응답에만 차감됩니다. 결제 후 7일 이내이고 유료 크레딧을 사용하지
            않은 경우 전액 환불을 요청할 수 있으며, 사용 이력이 있거나 서비스 장애·중복 결제 등
            특수한 사유가 있는 경우 개별 검토합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">제5조 (서비스 변경 및 중단)</h2>
          <p>
            서비스 제공자는 운영상·기술상 필요에 따라 서비스를 변경하거나 일시 중단할 수 있으며,
            중요한 변경 사항이 있을 경우 이메일 또는 서비스 내 공지를 통해 사전 안내합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">제6조 (면책)</h2>
          <p>
            서비스 내 AI 분석 결과는 참고 정보이며, 최종 지원 결정에 대한 책임은 이용자 본인에게
            있습니다. 서비스 제공자는 이용자가 서비스를 통해 얻은 정보에 기반한 의사결정 결과에
            대해 법적 책임을 지지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-slate-800">제7조 (문의)</h2>
          <p>
            이용약관에 관한 문의는{" "}
            {process.env.NEXT_PUBLIC_SUPPORT_EMAIL ? (
              <a
                className="text-slate-900 underline"
                href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`}
              >
                {process.env.NEXT_PUBLIC_SUPPORT_EMAIL}
              </a>
            ) : (
              "설정 화면 내 문의 양식"
            )}
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
