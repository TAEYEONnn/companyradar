import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <span className="text-2xl">🔗</span>
        </div>
        <h1 className="text-lg font-semibold text-slate-900">
          로그인 링크가 만료됐어요
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          링크가 만료됐거나 이미 사용된 링크입니다.
          <br />
          아래 버튼을 눌러 새 로그인 링크를 받아보세요.
        </p>
        <Link
          className="mt-5 inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700"
          href="/"
        >
          다시 로그인하기
        </Link>
      </section>
    </main>
  );
}
