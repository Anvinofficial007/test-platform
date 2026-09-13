// Wall-clock times in the admin UI are India Standard Time (no DST).
// Parsing datetime-local with `new Date("YYYY-MM-DDTHH:mm")` uses the
// *server* timezone, so a Vercel/UTC host stores the clock time as UTC
// and the test looks "upcoming" for another 5.5 hours in India.
export const APP_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function parseAdminDateTime(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    throw new Error("Start time must be a valid date and time");
  }
  const [, year, month, day, hour, minute, second] = match;
  const utcMs =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? 0)
    ) - IST_OFFSET_MS;
  return new Date(utcMs);
}

function tzPart(iso: string, type: Intl.DateTimeFormatPartTypes): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  return parts.find((p) => p.type === type)?.value ?? "";
}

export function toDatetimeLocalValue(iso: string): string {
  return `${tzPart(iso, "year")}-${tzPart(iso, "month")}-${tzPart(iso, "day")}T${tzPart(iso, "hour")}:${tzPart(iso, "minute")}`;
}

export function nowDatetimeLocalValue(): string {
  return toDatetimeLocalValue(new Date().toISOString());
}

export function formatInAppTz(
  iso: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Date(iso).toLocaleString("en-IN", { timeZone: APP_TIMEZONE, ...options });
}

export function liveMinutesFromWindow(startIso: string, endIso: string): number {
  const minutes = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000
  );
  return Math.max(1, minutes);
}
