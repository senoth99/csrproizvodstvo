"use client";

import { useEffect } from "react";
import { ensureAppServiceWorker } from "@/lib/appServiceWorker";

/** SW для кэша аватаров и push-уведомлений. */
export function AppServiceWorkerRegister() {
  useEffect(() => {
    void ensureAppServiceWorker();
  }, []);

  return null;
}
