/** Ответ API при отсутствии пользователя в allowlist */
export const ACCESS_DENIED_CODE = "ACCESS_DENIED" as const;

export type AccessDeniedPayload = {
  error?: string;
  code?: typeof ACCESS_DENIED_CODE;
};

export function isAccessDeniedResponse(status: number, body: AccessDeniedPayload): boolean {
  return (
    status === 403 &&
    (body.code === ACCESS_DENIED_CODE ||
      (typeof body.error === "string" && body.error.includes("Доступ не выдан")))
  );
}
