"use client";

import { useSearchParams } from "next/navigation";
import { QrCheckInCore } from "@/components/QrCheckInCore";

export function CheckInClient({ zoneName }: { zoneName: string }) {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("k")?.trim() || undefined;

  return (
    <QrCheckInCore
      zoneName={zoneName}
      autoStartScanner={!initialToken}
      initialToken={initialToken}
    />
  );
}
