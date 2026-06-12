"use client";

import {
  BarChart3,
  BrainCircuit,
  Building2,
  CalendarCheck,
  CalendarDays,
  Inbox,
  Settings2,
  Target,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ViewMode } from "./shared";

const GOAL_KEY = "career_tracker_monthly_goal";

function MonthlyGoalWidget({ appliedCount }: { appliedCount: number }) {
  const [goal, setGoal] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(GOAL_KEY)) || 0;
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function saveGoal() {
    const n = Math.max(0, Math.min(99, Number(draft) || 0));
    setGoal(n);
    localStorage.setItem(GOAL_KEY, String(n));
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Target className="h-3 w-3 shrink-0 text-slate-400" />
        <input
          autoFocus
          className="w-10 rounded border border-slate-300 px-1 text-xs"
          max={99}
          min={0}
          onBlur={saveGoal}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveGoal();
            if (e.key === "Escape") setEditing(false);
          }}
          type="number"
          value={draft}
        />
        <span className="text-xs text-slate-400">개 목표</span>
      </div>
    );
  }

  const month = new Date().toLocaleDateString("ko-KR", { month: "long" });
  const pct = goal > 0 ? Math.min(100, Math.round((appliedCount / goal) * 100)) : 0;

  return (
    <button
      className="w-full text-left"
      onClick={() => {
        setDraft(String(goal || ""));
        setEditing(true);
      }}
      title="클릭해서 목표 설정"
      type="button"
    >
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Target className="h-3 w-3 shrink-0" />
        <span>
          {month} 지원 {appliedCount}
          {goal > 0 ? `/${goal}` : ""}
        </span>
      </div>
      {goal > 0 && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-1 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </button>
  );
}

export interface SidebarBadges {
  inbox: number;
  deadline: number;
}

interface NavItem {
  id: ViewMode;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badgeKey?: keyof SidebarBadges;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", icon: Building2, label: "회사 목록" },
  { id: "inbox", icon: Inbox, label: "후보 검토", badgeKey: "inbox" },
  { id: "today", icon: CalendarCheck, label: "오늘 할 일" },
  { id: "timeline", icon: CalendarDays, label: "타임라인" },
  { id: "coach", icon: BrainCircuit, label: "AI 코치" },
  { id: "stats", icon: BarChart3, label: "통계" },
  { id: "settings", icon: Settings2, label: "설정" },
];

interface AppSidebarProps {
  userEmail: string;
  viewMode: ViewMode;
  badges: SidebarBadges;
  appliedCount: number;
  onNavigate: (mode: ViewMode) => void;
  onSignOut: () => void;
}

export function AppSidebar({
  userEmail,
  viewMode,
  badges,
  appliedCount,
  onNavigate,
  onSignOut,
}: AppSidebarProps) {
  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-slate-100 px-4">
        <Building2 className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-semibold text-slate-900">CareerTrack</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map(({ id, icon: Icon, label, badgeKey }) => {
          const count = badgeKey ? (badges[badgeKey] ?? 0) : 0;
          const isActive =
            viewMode === id ||
            (id === "dashboard" && (viewMode === "compare" || viewMode === "form"));
          return (
            <button
              key={id}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors",
                isActive
                  ? "bg-slate-900 font-medium text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
              onClick={() => onNavigate(id)}
              type="button"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "min-w-[20px] rounded-full px-1.5 text-center text-xs font-medium leading-5",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-600",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Alert badges — 마감 임박만 표시 */}
      {badges.deadline > 0 && (
        <div className="space-y-1 border-t border-slate-100 p-3">
          <button
            className="flex w-full items-center gap-2 rounded-md bg-amber-50 px-2 py-1.5 text-left text-xs text-amber-700 hover:bg-amber-100"
            onClick={() => onNavigate("today")}
            type="button"
          >
            <CalendarCheck className="h-3 w-3 shrink-0" />
            마감 임박 {badges.deadline}개
          </button>
        </div>
      )}

      {/* Monthly goal + User */}
      <div className="space-y-2 border-t border-slate-100 p-3">
        <MonthlyGoalWidget appliedCount={appliedCount} />
        <p className="truncate text-xs text-slate-400">{userEmail}</p>
        <button
          className="text-xs text-slate-400 hover:text-slate-700"
          onClick={onSignOut}
          type="button"
        >
          로그아웃
        </button>
      </div>
    </aside>
  );
}
