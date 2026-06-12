"use client";

import {
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  Flag,
  Inbox,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode } from "./shared";

export interface SidebarBadges {
  inbox: number;
  followUp: number;
  deadline: number;
  waiting: number;
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
  { id: "stats", icon: BarChart3, label: "통계" },
  { id: "settings", icon: Settings2, label: "설정" },
];

interface AppSidebarProps {
  userEmail: string;
  viewMode: ViewMode;
  badges: SidebarBadges;
  onNavigate: (mode: ViewMode) => void;
  onSignOut: () => void;
}

export function AppSidebar({
  userEmail,
  viewMode,
  badges,
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
            (id === "dashboard" && viewMode === "compare");
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

      {/* Alert badges */}
      {(badges.followUp > 0 || badges.deadline > 0 || badges.waiting > 0) && (
        <div className="space-y-1 border-t border-slate-100 p-3">
          {badges.followUp > 0 && (
            <button
              className="flex w-full items-center gap-2 rounded-md bg-red-50 px-2 py-1.5 text-left text-xs text-red-700 hover:bg-red-100"
              onClick={() => onNavigate("today")}
              type="button"
            >
              <Flag className="h-3 w-3 shrink-0" />
              팔로업 {badges.followUp}개
            </button>
          )}
          {badges.deadline > 0 && (
            <button
              className="flex w-full items-center gap-2 rounded-md bg-amber-50 px-2 py-1.5 text-left text-xs text-amber-700 hover:bg-amber-100"
              onClick={() => onNavigate("today")}
              type="button"
            >
              <CalendarCheck className="h-3 w-3 shrink-0" />
              마감 임박 {badges.deadline}개
            </button>
          )}
          {badges.waiting > 0 && (
            <button
              className="flex w-full items-center gap-2 rounded-md bg-sky-50 px-2 py-1.5 text-left text-xs text-sky-700 hover:bg-sky-100"
              onClick={() => onNavigate("dashboard")}
              type="button"
            >
              <Inbox className="h-3 w-3 shrink-0" />
              회신 대기 {badges.waiting}개
            </button>
          )}
        </div>
      )}

      {/* User */}
      <div className="border-t border-slate-100 p-3">
        <p className="truncate text-xs text-slate-400">{userEmail}</p>
        <button
          className="mt-1 text-xs text-slate-400 hover:text-slate-700"
          onClick={onSignOut}
          type="button"
        >
          로그아웃
        </button>
      </div>
    </aside>
  );
}
