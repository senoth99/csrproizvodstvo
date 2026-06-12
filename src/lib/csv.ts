/** RFC 4180: wrap every field in double quotes; escape internal quotes. */
export function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return `"${s.replaceAll('"', '""')}"`;
}
