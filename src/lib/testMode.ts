/** APP_TEST_MODE=true — авто-одобрение регистраций и пропуск проверок approvalStatus. */
export function isTestMode(): boolean {
  return process.env.APP_TEST_MODE === "true";
}

export function resolveRegistrationApprovalStatus(): "PENDING" | "APPROVED" {
  return isTestMode() ? "APPROVED" : "PENDING";
}

export function shouldSkipApprovalCheck(): boolean {
  return isTestMode();
}
