"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSupabaseClient } from "@/lib/supabase-client";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";
const REPLY_SIGNATURE = `\n\n---\nCompanyRadar 운영팀${SUPPORT_EMAIL ? `\n${SUPPORT_EMAIL}` : ""}`;

// TODO: 삭제 예정 (MVP 전)
const MOCK_SUPPORT: SupportRequest[] = [
  {
    id: "mock-s1",
    email: "ulbba08@gmail.com",
    request_type: "bug",
    subject: "AI 분석 점수가 0으로 나와요",
    message:
      "당근마켓 회사 등록 후 AI 분석 버튼을 클릭하면 점수가 0.0으로 나옵니다.\n\n재현 방법:\n1. 메인화면 > 회사 추가 > 당근마켓\n2. 드로어 > AI 분석 탭 클릭\n3. 결과 점수: 0.0\n\n정상 점수가 나오길 기대했습니다.",
    status: "open",
    created_at: "2026-06-14T09:15:00Z",
  },
  {
    id: "mock-s2",
    email: "ulbba08@gmail.com",
    request_type: "feature",
    subject: "면접 일정 캘린더 연동 기능 요청",
    message:
      "구글 캘린더나 애플 캘린더와 면접 일정이 연동되면 편할 것 같아요. 드로어에서 일정을 등록하면 자동으로 캘린더에 추가되는 방식이면 좋겠습니다.",
    status: "in_review",
    created_at: "2026-06-13T14:30:00Z",
  },
  {
    id: "mock-s3",
    email: "ulbba08@gmail.com",
    request_type: "account",
    subject: "비밀번호 변경 메일이 오지 않아요",
    message:
      "설정 화면에서 '재설정 메일 받기'를 눌렀는데 10분이 지나도 메일이 오지 않습니다. 스팸함도 확인했어요.",
    status: "resolved",
    created_at: "2026-06-12T10:00:00Z",
  },
];

const MOCK_REFUNDS: RefundRequest[] = [
  {
    id: "mock-r1",
    email: "ulbba08@gmail.com",
    order_id: "ORDER-20260613-00142",
    payment_key: null,
    reason:
      "AI 10회권을 두 번 결제한 것 같아요. 중복 결제가 된 것 같으니 한 건 취소 부탁드립니다.",
    status: "requested",
    created_at: "2026-06-13T16:45:00Z",
  },
];

const MOCK_DELETIONS: DeletionRequest[] = [
  {
    id: "mock-d1",
    email: "ulbba08@gmail.com",
    reason:
      "취업에 성공해서 더 이상 서비스를 이용하지 않게 됐습니다. 개인정보 삭제 부탁드립니다.",
    status: "requested",
    operator_note: "",
    created_at: "2026-06-12T11:20:00Z",
  },
];

type SupportRequest = {
  id: string;
  email: string;
  request_type: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  archived_at?: string | null;
  reply_body?: string;
  replied_at?: string | null;
};

type RefundRequest = {
  id: string;
  email: string;
  order_id: string | null;
  payment_key: string | null;
  reason: string;
  status: string;
  created_at: string;
  archived_at?: string | null;
  reply_body?: string;
  replied_at?: string | null;
};

type DeletionRequest = {
  id: string;
  email: string;
  reason: string;
  status: string;
  operator_note: string;
  created_at: string;
  archived_at?: string | null;
  reply_body?: string;
  replied_at?: string | null;
};

type Tab = "support" | "refund" | "deletion";

const SUPPORT_STATUS_LABELS: Record<string, string> = {
  open: "미처리",
  in_review: "처리 중",
  resolved: "완료",
  closed: "닫힘",
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  requested: "요청됨",
  in_review: "검토 중",
  approved: "승인",
  rejected: "거절",
  canceled: "취소됨",
};

const DELETION_STATUS_LABELS: Record<string, string> = {
  requested: "요청됨",
  in_review: "검토 중",
  completed: "처리 완료",
  canceled: "취소됨",
};

const STATUS_TONE: Record<string, "amber" | "blue" | "green" | "red" | "slate"> = {
  open: "amber",
  requested: "amber",
  in_review: "blue",
  resolved: "green",
  approved: "green",
  completed: "green",
  closed: "slate",
  rejected: "red",
  canceled: "slate",
};

function formatDate(iso: string) {
  return iso.slice(0, 10).replace(/-/g, "/");
}

function buildGmailLink(email: string, subject: string, body: string) {
  return (
    `https://mail.google.com/mail/?view=cm&fs=1` +
    `&to=${encodeURIComponent(email)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  );
}

function getSupportReplyBody(req: SupportRequest) {
  const answerByStatus: Record<string, string> = {
    open: "(문의 내용을 확인한 뒤 답변을 작성해 주세요)",
    in_review:
      "문의 내용을 확인하고 있습니다.\n재현 환경과 계정 상태를 함께 점검한 뒤 추가 안내드리겠습니다.",
    resolved:
      "문의하신 내용을 확인해 안내드립니다.\n\n(해결 내용과 사용자가 다음에 할 일을 작성해 주세요)",
    closed:
      "이 문의는 추가 조치 없이 종료되었습니다.\n다시 도움이 필요하시면 이 메일로 회신해 주세요.",
  };

  return (
    `안녕하세요.\n\nCompanyRadar를 이용해 주셔서 감사합니다.\n` +
    `문의 내용을 확인했습니다.\n\n[문의 내용]\n${req.message}\n\n` +
    `[답변]\n${answerByStatus[req.status] ?? answerByStatus.open}\n\n` +
    `추가 문의사항이 있으시면 이 메일로 회신해 주세요.${REPLY_SIGNATURE}`
  );
}

function getRefundReplyBody(req: RefundRequest) {
  const resultByStatus: Record<string, string> = {
    requested: "(결제 이력과 사용 이력을 확인한 뒤 승인/거절 여부를 작성해 주세요)",
    in_review:
      "환불 가능 여부를 확인하고 있습니다.\n결제 이력, 유료 크레딧 사용 여부, 중복 결제 여부를 확인한 뒤 안내드리겠습니다.",
    approved:
      "환불 요청을 승인했습니다.\n결제 수단에 따라 실제 환불 완료까지 3-5 영업일이 걸릴 수 있습니다.",
    rejected:
      "환불 요청을 검토했으나 환불 가능 조건에 해당하지 않아 승인하기 어렵습니다.\n\n(거절 사유를 구체적으로 작성해 주세요)",
    canceled:
      "환불 요청은 취소 처리되었습니다.\n다시 환불 확인이 필요하시면 이 메일로 회신해 주세요.",
  };

  return (
    `안녕하세요.\n\nCompanyRadar를 이용해 주셔서 감사합니다.\n` +
    `환불 요청을 확인했습니다.\n\n[요청 내용]\n${req.reason}` +
    `${req.order_id ? `\n주문 ID: ${req.order_id}` : ""}\n\n` +
    `[처리 결과]\n${resultByStatus[req.status] ?? resultByStatus.requested}\n\n` +
    `추가 문의는 이 메일로 회신해 주세요.${REPLY_SIGNATURE}`
  );
}

function getDeletionReplyBody(req: DeletionRequest) {
  const resultByStatus: Record<string, string> = {
    requested:
      "회원탈퇴 요청을 접수했습니다.\n계정 삭제 전 미처리 결제나 환불 건이 있는지 먼저 확인해 드립니다.",
    in_review:
      "회원탈퇴 처리를 검토하고 있습니다.\n결제, 환불, 보관 의무가 있는 정보를 확인한 뒤 처리 결과를 안내드리겠습니다.",
    completed:
      "회원탈퇴 처리가 완료되었습니다.\n법령상 보관이 필요한 결제/분쟁 대응 정보 외의 서비스 이용 데이터는 삭제 처리했습니다.",
    canceled:
      "회원탈퇴 요청은 취소 처리되었습니다.\n서비스 이용 중 도움이 필요하시면 이 메일로 회신해 주세요.",
  };

  return (
    `안녕하세요.\n\n회원탈퇴 요청 관련 안내드립니다.\n\n` +
    `[요청 사유]\n${req.reason || "사유 없음"}\n\n` +
    `[처리 상태]\n${resultByStatus[req.status] ?? resultByStatus.requested}\n\n` +
    `추가 확인이 필요하면 이 메일로 회신해 주세요.${REPLY_SIGNATURE}`
  );
}

function getStatusToast(status: string) {
  const doneStatuses = ["resolved", "closed", "approved", "rejected", "canceled", "completed"];
  if (doneStatuses.includes(status)) {
    return "상태가 완료로 바뀌었습니다. 미처리 필터에서는 목록에서 사라질 수 있어요.";
  }
  return "상태가 업데이트됐습니다. 답장 내용도 새 상태에 맞게 바뀌었습니다.";
}

async function updateStatus(
  table: string,
  id: string,
  accessToken: string,
  patch: { status?: string; archived?: boolean; replyBody?: string; markReplied?: boolean },
): Promise<boolean> {
  const res = await fetch("/api/admin/update-request-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ table, id, ...patch }),
  });
  return res.ok;
}

async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

interface AdminDashboardProps {
  initialSupport: SupportRequest[];
  initialRefunds: RefundRequest[];
  initialDeletions: DeletionRequest[];
}

export function AdminDashboard({
  initialSupport,
  initialRefunds,
  initialDeletions,
}: AdminDashboardProps) {
  const [tab, setTab] = useState<Tab>("support");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done" | "archived">("all");
  const [support, setSupport] = useState(initialSupport);
  const [refunds, setRefunds] = useState(initialRefunds);
  const [deletions, setDeletions] = useState(initialDeletions);
  const [updating, setUpdating] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  function togglePreview(id: string) {
    setPreviewId((prev) => (prev === id ? null : id));
  }

  function getReplyDraft<T extends { id: string; reply_body?: string }>(
    req: T,
    fallback: string,
  ) {
    return replyDrafts[req.id] ?? req.reply_body ?? fallback;
  }

  function changeReplyDraft(id: string, value: string) {
    setReplyDrafts((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSupportStatus(id: string, status: string) {
    setUpdating(id);
    const token = await getAccessToken();
    if (!token) { setUpdating(null); showToast("로그인이 필요합니다."); return; }
    const ok = await updateStatus("support_requests", id, token, { status });
    if (ok) {
      setSupport((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
      showToast(getStatusToast(status));
    } else {
      showToast("상태 업데이트에 실패했습니다.");
    }
    setUpdating(null);
  }

  async function handleRefundStatus(id: string, status: string) {
    setUpdating(id);
    const token = await getAccessToken();
    if (!token) { setUpdating(null); showToast("로그인이 필요합니다."); return; }
    const ok = await updateStatus("refund_requests", id, token, { status });
    if (ok) {
      setRefunds((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
      showToast(getStatusToast(status));
    } else {
      showToast("상태 업데이트에 실패했습니다.");
    }
    setUpdating(null);
  }

  async function handleDeletionStatus(id: string, status: string) {
    setUpdating(id);
    const token = await getAccessToken();
    if (!token) { setUpdating(null); showToast("로그인이 필요합니다."); return; }
    const ok = await updateStatus("account_deletion_requests", id, token, { status });
    if (ok) {
      setDeletions((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
      showToast(getStatusToast(status));
    } else {
      showToast("상태 업데이트에 실패했습니다.");
    }
    setUpdating(null);
  }

  function filterByStatus<T extends { status: string }>(items: T[]) {
    const rows = items as (T & { archived_at?: string | null })[];
    if (statusFilter === "archived") return rows.filter((r) => r.archived_at);
    const visible = rows.filter((r) => !r.archived_at);
    if (statusFilter === "pending") return visible.filter((r) => ["open", "requested", "in_review"].includes(r.status));
    if (statusFilter === "done") return visible.filter((r) => ["resolved", "closed", "approved", "rejected", "canceled", "completed"].includes(r.status));
    return visible;
  }

  async function handleArchive(table: string, id: string, archived: boolean) {
    setUpdating(id);
    const token = await getAccessToken();
    if (!token) { setUpdating(null); showToast("로그인이 필요합니다."); return; }
    const ok = await updateStatus(table, id, token, { archived });
    const archived_at = archived ? new Date().toISOString() : null;
    if (ok) {
      if (table === "support_requests") setSupport((prev) => prev.map((r) => r.id === id ? { ...r, archived_at } : r));
      if (table === "refund_requests") setRefunds((prev) => prev.map((r) => r.id === id ? { ...r, archived_at } : r));
      if (table === "account_deletion_requests") setDeletions((prev) => prev.map((r) => r.id === id ? { ...r, archived_at } : r));
      showToast(archived ? "아카이브로 보냈습니다." : "아카이브에서 복원했습니다.");
    } else {
      showToast("아카이브 처리에 실패했습니다.");
    }
    setUpdating(null);
  }

  async function handleReplyOpen(table: string, id: string, replyBody: string) {
    const token = await getAccessToken();
    if (!token) { showToast("로그인이 필요합니다."); return; }
    // Optimistic update so the textarea immediately reflects what was sent.
    const replied_at = new Date().toISOString();
    if (table === "support_requests") setSupport((prev) => prev.map((r) => r.id === id ? { ...r, reply_body: replyBody, replied_at } : r));
    if (table === "refund_requests") setRefunds((prev) => prev.map((r) => r.id === id ? { ...r, reply_body: replyBody, replied_at } : r));
    if (table === "account_deletion_requests") setDeletions((prev) => prev.map((r) => r.id === id ? { ...r, reply_body: replyBody, replied_at } : r));
    const ok = await updateStatus(table, id, token, { replyBody, markReplied: true });
    if (!ok) showToast("답장 내용 저장에 실패했습니다. DB 스키마를 확인해주세요.");
  }

  const pendingSupportCount = support.filter((r) => !r.archived_at && ["open", "in_review"].includes(r.status)).length;
  const pendingRefundCount = refunds.filter((r) => !r.archived_at && ["requested", "in_review"].includes(r.status)).length;
  const pendingDeletionCount = deletions.filter((r) => !r.archived_at && ["requested", "in_review"].includes(r.status)).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">운영자 대시보드</h1>
            <p className="mt-1 text-sm text-slate-500">문의·환불·탈퇴 요청을 관리합니다.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* TODO: MVP 전에 삭제 */}
            <button
              className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100"
              onClick={() => {
                setSupport(MOCK_SUPPORT);
                setRefunds(MOCK_REFUNDS);
                setDeletions(MOCK_DELETIONS);
                setStatusFilter("all");
                showToast("테스트 데이터를 불러왔습니다.");
              }}
              type="button"
            >
              테스트 데이터
            </button>
            <Link
              className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              href="/"
            >
              <ArrowLeft className="h-4 w-4" />
              앱으로 돌아가기
            </Link>
          </div>
        </div>

        {/* 탭 */}
        <div className="mb-4 flex gap-2">
          {(
            [
              { id: "support" as Tab, label: "문의", count: pendingSupportCount },
              { id: "refund" as Tab, label: "환불", count: pendingRefundCount },
              { id: "deletion" as Tab, label: "탈퇴", count: pendingDeletionCount },
            ] as const
          ).map(({ id, label, count }) => (
            <button
              className={[
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                tab === id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              ].join(" ")}
              key={id}
              onClick={() => setTab(id)}
              type="button"
            >
              {label}
              {count > 0 && (
                <span className={["rounded-full px-1.5 text-xs font-semibold", tab === id ? "bg-white/20" : "bg-amber-100 text-amber-700"].join(" ")}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 상태 필터 */}
        <div className="mb-4 flex gap-2">
          {([["all", "전체"], ["pending", "미처리"], ["done", "완료"], ["archived", "아카이브"]] as const).map(([val, label]) => (
            <button
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === val
                  ? "border-sky-500 bg-sky-100 text-sky-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
              ].join(" ")}
              key={val}
              onClick={() => setStatusFilter(val)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {/* 문의 목록 */}
        {tab === "support" && (
          <div className="space-y-3">
            {filterByStatus(support).length === 0 && (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
                {statusFilter === "pending" ? "미처리 문의가 없습니다." : "해당하는 문의가 없습니다."}
              </div>
            )}
            {filterByStatus(support).map((req) => {
              const templateBody = getSupportReplyBody(req);
              const replyBody = getReplyDraft(req, templateBody);
              const gmailLink = buildGmailLink(req.email, `Re: [CompanyRadar] ${req.subject}`, replyBody);
              const isPreviewOpen = previewId === req.id;
              return (
                <div className="rounded-lg border border-slate-200 bg-white p-4" key={req.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={STATUS_TONE[req.status] ?? "slate"}>
                          {SUPPORT_STATUS_LABELS[req.status] ?? req.status}
                        </Badge>
                        <span className="text-xs text-slate-400">{req.request_type}</span>
                        <span className="text-xs text-slate-400">{formatDate(req.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-700">{req.email}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{req.subject}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <a
                        className="inline-flex h-8 items-center rounded-md border border-sky-300 bg-sky-50 px-3 text-xs font-medium text-sky-700 hover:bg-sky-100"
                        href={gmailLink}
                        onClick={() => void handleReplyOpen("support_requests", req.id, replyBody)}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Gmail로 답장
                      </a>
                      <button
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-500 hover:bg-slate-50"
                        onClick={() => togglePreview(req.id)}
                        type="button"
                      >
                        {isPreviewOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        답장 내용
                      </button>
                      {req.status === "open" && (
                        <Button disabled={updating === req.id} onClick={() => void handleSupportStatus(req.id, "in_review")} size="sm" variant="secondary">
                          {updating === req.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          검토 중으로 표시
                        </Button>
                      )}
                      {["open", "in_review"].includes(req.status) && (
                        <Button disabled={updating === req.id} onClick={() => void handleSupportStatus(req.id, "resolved")} size="sm" variant="secondary">
                          {updating === req.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          처리 완료로 표시
                        </Button>
                      )}
                      {req.status === "resolved" && (
                        <Button disabled={updating === req.id} onClick={() => void handleSupportStatus(req.id, "open")} size="sm" variant="ghost">
                          되돌리기
                        </Button>
                      )}
                      <Button disabled={updating === req.id} onClick={() => void handleArchive("support_requests", req.id, !req.archived_at)} size="sm" variant="ghost">
                        {req.archived_at ? "복원" : "아카이브"}
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                    {req.message}
                  </p>
                  {isPreviewOpen && (
                    <div className="mt-2 rounded-md border border-sky-100 bg-sky-50 p-3">
                      <p className="mb-1.5 text-xs font-medium text-sky-700">사용자에게 보낼 답장 내용</p>
                      <textarea
                        className="min-h-48 w-full rounded-md border border-sky-100 bg-white p-2 text-xs leading-relaxed text-slate-700 outline-none focus:ring-2 focus:ring-sky-200"
                        onChange={(event) => changeReplyDraft(req.id, event.target.value)}
                        value={replyBody}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 환불 목록 */}
        {tab === "refund" && (
          <div className="space-y-3">
            {filterByStatus(refunds).length === 0 && (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
                {statusFilter === "pending" ? "미처리 환불 요청이 없습니다." : "해당하는 환불 요청이 없습니다."}
              </div>
            )}
            {filterByStatus(refunds).map((req) => {
              const templateBody = getRefundReplyBody(req);
              const replyBody = getReplyDraft(req, templateBody);
              const gmailLink = buildGmailLink(req.email, `Re: [CompanyRadar] 환불 처리 안내`, replyBody);
              const isPreviewOpen = previewId === req.id;
              return (
                <div className="rounded-lg border border-slate-200 bg-white p-4" key={req.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={STATUS_TONE[req.status] ?? "slate"}>
                          {REFUND_STATUS_LABELS[req.status] ?? req.status}
                        </Badge>
                        <span className="text-xs text-slate-400">{formatDate(req.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-700">{req.email}</p>
                      {req.order_id && <p className="mt-0.5 text-xs text-slate-400">주문 ID: {req.order_id}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <a
                        className="inline-flex h-8 items-center rounded-md border border-sky-300 bg-sky-50 px-3 text-xs font-medium text-sky-700 hover:bg-sky-100"
                        href={gmailLink}
                        onClick={() => void handleReplyOpen("refund_requests", req.id, replyBody)}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Gmail로 답장
                      </a>
                      <button
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-500 hover:bg-slate-50"
                        onClick={() => togglePreview(req.id)}
                        type="button"
                      >
                        {isPreviewOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        답장 내용
                      </button>
                      {["requested", "in_review"].includes(req.status) && (
                        <Button disabled={updating === req.id} onClick={() => void handleRefundStatus(req.id, "approved")} size="sm" variant="secondary">
                          {updating === req.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          승인으로 표시
                        </Button>
                      )}
                      {["requested", "in_review"].includes(req.status) && (
                        <Button disabled={updating === req.id} onClick={() => void handleRefundStatus(req.id, "rejected")} size="sm" variant="ghost">
                          거절로 표시
                        </Button>
                      )}
                      {["approved", "rejected"].includes(req.status) && (
                        <Button disabled={updating === req.id} onClick={() => void handleRefundStatus(req.id, "requested")} size="sm" variant="ghost">
                          되돌리기
                        </Button>
                      )}
                      <Button disabled={updating === req.id} onClick={() => void handleArchive("refund_requests", req.id, !req.archived_at)} size="sm" variant="ghost">
                        {req.archived_at ? "복원" : "아카이브"}
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                    {req.reason}
                  </p>
                  {isPreviewOpen && (
                    <div className="mt-2 rounded-md border border-sky-100 bg-sky-50 p-3">
                      <p className="mb-1.5 text-xs font-medium text-sky-700">사용자에게 보낼 답장 내용</p>
                      <textarea
                        className="min-h-48 w-full rounded-md border border-sky-100 bg-white p-2 text-xs leading-relaxed text-slate-700 outline-none focus:ring-2 focus:ring-sky-200"
                        onChange={(event) => changeReplyDraft(req.id, event.target.value)}
                        value={replyBody}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 탈퇴 목록 */}
        {tab === "deletion" && (
          <div className="space-y-3">
            {filterByStatus(deletions).length === 0 && (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
                {statusFilter === "pending" ? "미처리 탈퇴 요청이 없습니다." : "해당하는 탈퇴 요청이 없습니다."}
              </div>
            )}
            {filterByStatus(deletions).map((req) => {
              const templateBody = getDeletionReplyBody(req);
              const replyBody = getReplyDraft(req, templateBody);
              const gmailLink = buildGmailLink(req.email, `Re: [CompanyRadar] 회원탈퇴 요청 접수 확인`, replyBody);
              const isPreviewOpen = previewId === req.id;
              return (
                <div className="rounded-lg border border-slate-200 bg-white p-4" key={req.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={STATUS_TONE[req.status] ?? "slate"}>
                          {DELETION_STATUS_LABELS[req.status] ?? req.status}
                        </Badge>
                        <span className="text-xs text-slate-400">{formatDate(req.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-700">{req.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <a
                        className="inline-flex h-8 items-center rounded-md border border-sky-300 bg-sky-50 px-3 text-xs font-medium text-sky-700 hover:bg-sky-100"
                        href={gmailLink}
                        onClick={() => void handleReplyOpen("account_deletion_requests", req.id, replyBody)}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Gmail로 답장
                      </a>
                      <button
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-500 hover:bg-slate-50"
                        onClick={() => togglePreview(req.id)}
                        type="button"
                      >
                        {isPreviewOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        답장 내용
                      </button>
                      {["requested", "in_review"].includes(req.status) && (
                        <Button disabled={updating === req.id} onClick={() => void handleDeletionStatus(req.id, "completed")} size="sm" variant="secondary">
                          {updating === req.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          완료로 표시
                        </Button>
                      )}
                      {req.status === "requested" && (
                        <Button disabled={updating === req.id} onClick={() => void handleDeletionStatus(req.id, "canceled")} size="sm" variant="ghost">
                          요청 취소
                        </Button>
                      )}
                      {req.status === "completed" && (
                        <Button disabled={updating === req.id} onClick={() => void handleDeletionStatus(req.id, "requested")} size="sm" variant="ghost">
                          되돌리기
                        </Button>
                      )}
                      <Button disabled={updating === req.id} onClick={() => void handleArchive("account_deletion_requests", req.id, !req.archived_at)} size="sm" variant="ghost">
                        {req.archived_at ? "복원" : "아카이브"}
                      </Button>
                    </div>
                  </div>
                  {req.reason && (
                    <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                      {req.reason}
                    </p>
                  )}
                  {isPreviewOpen && (
                    <div className="mt-2 rounded-md border border-sky-100 bg-sky-50 p-3">
                      <p className="mb-1.5 text-xs font-medium text-sky-700">사용자에게 보낼 답장 내용</p>
                      <textarea
                        className="min-h-48 w-full rounded-md border border-sky-100 bg-white p-2 text-xs leading-relaxed text-slate-700 outline-none focus:ring-2 focus:ring-sky-200"
                        onChange={(event) => changeReplyDraft(req.id, event.target.value)}
                        value={replyBody}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
