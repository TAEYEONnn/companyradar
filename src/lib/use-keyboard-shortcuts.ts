"use client";

import { useEffect } from "react";

interface ShortcutHandlers {
  onNewCompany: () => void;
  onEscape: () => void;
  onFocusSearch: () => void;
  onOpenStats: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * 전역 키보드 단축키
 * - n : 회사 추가
 * - / : 검색창 포커스
 * - s : 통계 보기
 * - ESC : 대시보드로 돌아가기
 */
export function useKeyboardShortcuts({
  onNewCompany,
  onEscape,
  onFocusSearch,
  onOpenStats,
}: ShortcutHandlers) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onEscape();
        return;
      }

      if (isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        onNewCompany();
      } else if (event.key === "/") {
        event.preventDefault();
        onFocusSearch();
      } else if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        onOpenStats();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onEscape, onFocusSearch, onNewCompany, onOpenStats]);
}
