// Pure due-time logic for the vendor sync scheduler. No SQL, no browser
// globals — this module is bundled for both the browser build and the Deno
// Edge Function (see src/supabase/functions/_shared/ingest.entry.ts).

export const SCHEDULE_TICK_TOLERANCE_MINUTES = 10;

export interface VendorScheduleState {
  schedule_enabled: boolean;
  schedule_times: string[]; // 'HH:MM', vendor local time
  schedule_timezone: string; // IANA name, e.g. 'Asia/Taipei'
  last_scheduled_run_at?: string | null; // ISO 8601 UTC
}

// Extracts the year/month/day that a given instant falls on, as seen from
// `timeZone`. Throws for an unknown IANA name — callers must catch.
function zonedDateParts(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

// UTC offset (in ms, positive east of UTC) that `timeZone` observes at the
// instant `utcMs`. Throws for an unknown IANA name — callers must catch.
function timeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  // Some ICU builds render midnight as hour '24' rather than '00'.
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  );

  return asUtc - utcMs;
}

// Resolves a local wall-clock y/m/d + HH:MM in `timeZone` to the absolute
// instant it represents. Throws for an unknown IANA name — callers must catch.
function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = timeZoneOffsetMs(guess, timeZone);
  return new Date(guess - offset);
}

export function dueOccurrence(state: VendorScheduleState, now: Date): Date | null {
  if (!state.schedule_enabled || !state.schedule_times || state.schedule_times.length === 0) {
    return null;
  }

  let candidates: Date[];
  try {
    const today = zonedDateParts(now, state.schedule_timezone);
    // JS Date normalises day 0 into the last day of the previous month, so
    // this is a safe way to step back one calendar day without a date lib.
    const yesterdayUtc = new Date(Date.UTC(today.year, today.month - 1, today.day - 1));
    const yesterday = {
      year: yesterdayUtc.getUTCFullYear(),
      month: yesterdayUtc.getUTCMonth() + 1,
      day: yesterdayUtc.getUTCDate(),
    };

    candidates = state.schedule_times.flatMap((hhmm) => {
      const [hour, minute] = hhmm.split(':').map(Number);
      return [
        zonedTimeToUtc(today.year, today.month, today.day, hour, minute, state.schedule_timezone),
        zonedTimeToUtc(yesterday.year, yesterday.month, yesterday.day, hour, minute, state.schedule_timezone),
      ];
    });
  } catch {
    // Unknown timezone: treat as not due, let the caller decide whether to log.
    return null;
  }

  const past = candidates.filter((candidate) => candidate.getTime() <= now.getTime());
  if (past.length === 0) return null;

  const latest = past.reduce((a, b) => (b.getTime() > a.getTime() ? b : a));

  const ageMinutes = (now.getTime() - latest.getTime()) / 60000;
  if (ageMinutes > SCHEDULE_TICK_TOLERANCE_MINUTES) return null;

  if (state.last_scheduled_run_at) {
    const lastRun = new Date(state.last_scheduled_run_at);
    if (lastRun.getTime() >= latest.getTime()) return null;
  }

  return latest;
}

export function isVendorDue(state: VendorScheduleState, now: Date): boolean {
  return dueOccurrence(state, now) !== null;
}
