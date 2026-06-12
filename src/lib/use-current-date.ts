"use client";

import { useEffect, useState } from "react";
import { today } from "@/lib/utils";

export function useCurrentDate(): string {
  const [currentDate, setCurrentDate] = useState(() => today());

  useEffect(() => {
    function refreshDate() {
      setCurrentDate(today());
    }

    refreshDate();
    const intervalId = window.setInterval(refreshDate, 60_000);
    document.addEventListener("visibilitychange", refreshDate);
    window.addEventListener("focus", refreshDate);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshDate);
      window.removeEventListener("focus", refreshDate);
    };
  }, []);

  return currentDate;
}
