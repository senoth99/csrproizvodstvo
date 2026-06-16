"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isStandalonePwa } from "@/lib/pwa";

/**
 * iOS standalone: после возврата из bfcache или смены вкладки Safari иногда показывает устаревший RSC.
 */
export function PwaLifecycle() {
  const router = useRouter();

  useEffect(() => {
    if (!isStandalonePwa()) return;

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) router.refresh();
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [router]);

  return null;
}
