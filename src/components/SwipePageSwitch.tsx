"use client";

import { useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const SWIPE_THRESHOLD = 60;
const VERTICAL_TOLERANCE = 48;

export function SwipePageSwitch({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const swipeEnabled = pathname.startsWith("/schedule") || pathname.startsWith("/me");
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!swipeEnabled) return;
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        "input,textarea,select,button,a,[data-no-swipe='true'],[role='button'],[role='link'],[role='tab']"
      )
    ) {
      startX.current = null;
      startY.current = null;
      return;
    }
    startX.current = event.touches[0]?.clientX ?? null;
    startY.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!swipeEnabled) return;
    if (startX.current === null || startY.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? startX.current;
    const endY = event.changedTouches[0]?.clientY ?? startY.current;
    const deltaX = endX - startX.current;
    const deltaY = endY - startY.current;
    startX.current = null;
    startY.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaY) > VERTICAL_TOLERANCE) return;
    if (pathname.startsWith("/schedule")) {
      router.push("/me");
      return;
    }
    if (pathname.startsWith("/me")) {
      router.push("/schedule");
    }
  };

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {children}
    </div>
  );
}
