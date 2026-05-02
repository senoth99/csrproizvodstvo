/** Не дублировать строку ФИО, если все части уже входят в основное отображаемое имя. */
export function isFormalNameLineRedundant(
  displayName: string,
  firstName: string | null,
  lastName: string | null
): boolean {
  const parts = [lastName?.trim(), firstName?.trim()].filter((p): p is string => Boolean(p && p.length > 0));
  if (parts.length === 0) return false;
  const dn = displayName.toLowerCase();
  return parts.every((p) => dn.includes(p.toLowerCase()));
}
