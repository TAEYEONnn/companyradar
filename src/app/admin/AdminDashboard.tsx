"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSupabaseClient } from "@/lib/supabase-client";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";
const REPLY_SIGNATURE = `\n\n---\nCompanyRadar 운영팀${SUPPORT_EMAIL ? `\n${SUPPORT_EMAIL}` : ""}`;

type SupportRequest = {
  id: string;
  email: string;
  request_type: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};

type RefundRequest = {
  id: string;
  email: string;
  order_id: string | null;
  payment_key: string | null;
  reason: string;
  status: string;
  created_at: string;
};

type DeletionRequest = {
  id: string;
  email: string;
  reason: string;
  status: string;
  operator_note: string;
  created_at: string;
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

function buildMailtoLink(
  email: string,
  subject: string,
  bodyTemplate: string,
) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyTemplate)}`;
}

async function updateStatus(
  table: string,
  id: string,
  status: string,
  accessToken: string,
): Promise<boolean> {
  const res = await fetch("/api/admin/update-request-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ table, id, status }),
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
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">("all");
  const [support, setSupport] = useState(initialSupport);
  const [refunds, setRefunds] = useState(initialRefunds);
  const [deletions, setDeletions] = useState(initialDeletions);
  const [updating, setUpdating] = useState<string | null>(null);

  async function handleSupportStatus(id: string, status: string) {
    setUpdating(id);
    const token = await getAccessToken();
    if (!token) { setUpdating(null); return; }
    const ok = await updateStatus("support_requests", id, status, token);
    if (ok) setSupport((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    setUpdating(null);
  }

  async function handleRefundStatus(id: string, status: string) {
    setUpdating(id);
    const token = await getAccessToken();
    if (!token) { setUpdating(null); return; }
    const ok = await updateStatus("refund_requests", id, status, token);
    if (ok) setRefunds((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    setUpdating(null);
  }

  async function handleDeletionStatus(id: string, status: string) {
    setUpdating(id);
    const token = await getAccessToken();
    if (!token) { setUpdating(null); return; }
    const ok = await updateStatus("account_deletion_requests", id, status, token);
    if (ok) setDeletions((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    setUpdating(null);
  }

  function filterByStatus<T extends { status: string }>(items: T[]) {
    if (statusFilter === "pending") return items.filter((r) => ["open", "requested", "in_review"].includes(r.status));
    if (statusFilter === "done") return items.filter((r) => ["resolved", "closed", "approved", "rejected", "canceled", "completed"].includes(r.status));
    return items;
  }

  const pendingSupportCount = support.filter((r) => ["open", "in_review"].includes(r.status)).length;
  const pendingRefundCount = refunds.filter((r) => ["requested", "in_review"].includes(r.status)).length;
  const pendingDeletionCount = deletions.filter((r) => ["requested", "in_review"].includes(r.status)).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">운영자 대시보드</h1>
            <p className="mt-1 text-sm text-slate-500">문의·환불·탈퇴 요청을 관리합니다.</p>
          </div>
          <a
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            href="/"
          >
            <ArrowLeft className="h-4 w-4" />
            앱으로 돌아가기
          </a>
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
          {([["all", "전체"], ["pending", "미처리"], ["done", "완료"]] as const).map(([val, label]) => (
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
                해당하는 문의가 없습니다.
              </div>
            )}
            {filterByStatus(support).map((req) => (
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
                      href={buildMailtoLink(
                        req.email,
                        `Re: [CompanyRadar] ${req.subject}`,
                        `안녕하세요.\n\nCompanyRadar를 이용해 주셔서 감사합니다.\n문의 내용을 확인했습니다.\n\n[문의 내용]\n${req.message}\n\n[답변]\n(이 부분을 작성해 주세요)\n\n추가 문의사항이 있으시면 이 메일로 회신해 주세요.${REPLY_SIGNATURE}`,
                      )}
                    >
                      답장 이메일 열기
                    </a>
                    {req.status === "open" && (
                      <Button disabled={updating === req.id} onClick={() => void handleSupportStatus(req.id, "in_review")} size="sm" variant="secondary">
                        검토 중으로
                      </Button>
                    )}
                    {["open", "in_review"].includes(req.status) && (
                      <Button disabled={updating === req.id} onClick={() => void handleSupportStatus(req.id, "resolved")} size="sm" variant="secondary">
                        완료
                      </Button>
                    )}
                    {req.status !== "closed" && (
                      <Button disabled={updating === req.id} onClick={() => void handleSupportStatus(req.id, "closed")} size="sm" variant="ghost">
                        닫기
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                  {req.message}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 환불 목록 */}
        {tab === "refund" && (
          <div className="space-y-3">
            {filterByStatus(refunds).length === 0 && (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
                해당하는 환불 요청이 없습니다.
              </div>
            )}
            {filterByStatus(refunds).map((req) => (
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
                      href={buildMailtoLink(
                        req.email,
                        `Re: [CompanyRadar] 환불 처리 안내`,
                        `안녕하세요.\n\nCompanyRadar를 이용해 주셔서 감사합니다.\n환불 요청을 확인했습니다.\n\n[요청 내용]\n${req.reason}${req.order_id ? `\n주문 ID: ${req.order_id}` : ""}\n\n[처리 결과]\n(승인/거절 여부와 사유를 작성해 주세요)\n\n환불 승인 시 결제 수단에 따라 3–5 영업일 내 처리됩니다.\n추가 문의는 이 메일로 회신해 주세요.${REPLY_SIGNATURE}`,
                      )}
                    >
                      답장 이메일 열기
                    </a>
                    {["requested", "in_review"].includes(req.status) && (
                      <Button disabled={updating === req.id} onClick={() => void handleRefundStatus(req.id, "approved")} size="sm" variant="secondary">
                        환불 승인
                      </Button>
                    )}
                    {["requested", "in_review"].includes(req.status) && (
                      <Button disabled={updating === req.id} onClick={() => void handleRefundStatus(req.id, "rejected")} size="sm" variant="ghost">
                        거절
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                  {req.reason}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 탈퇴 목록 */}
        {tab === "deletion" && (
          <div className="space-y-3">
            {filterByStatus(deletions).length === 0 && (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
                해당하는 탈퇴 요청이 없습니다.
              </div>
            )}
            {filterByStatus(deletions).map((req) => (
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
                      href={buildMailtoLink(
                        req.email,
                        `Re: [CompanyRadar] 회원탈퇴 요청 접수 확인`,
                        `안녕하세요.\n\n회원탈퇴 요청을 접수했습니다.\n\n[요청 사유]\n${req.reason || "사유 없음"}\n\n계정 삭제 전 미처리된 결제나 환불 건이 있는지 먼저 확인해 드립니다.\n처리가 완료되면 이 메일로 안내 드리겠습니다.\n\n처리 예정일: 영업일 기준 3일 이내${REPLY_SIGNATURE}`,
                      )}
                    >
                      답장 이메일 열기
                    </a>
                    {["requested", "in_review"].includes(req.status) && (
                      <Button disabled={updating === req.id} onClick={() => void handleDeletionStatus(req.id, "completed")} size="sm" variant="secondary">
                        처리 완료
                      </Button>
                    )}
                    {req.status === "requested" && (
                      <Button disabled={updating === req.id} onClick={() => void handleDeletionStatus(req.id, "canceled")} size="sm" variant="ghost">
                        취소
                      </Button>
                    )}
                  </div>
                </div>
                {req.reason && (
                  <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                    {req.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
