import { describe, it, expect } from 'vitest';
import {
  dueOccurrence,
  isVendorDue,
  SCHEDULE_TICK_TOLERANCE_MINUTES,
  VendorScheduleState,
} from '@/services/scheduleWindow';

const state = (over: Partial<VendorScheduleState> = {}): VendorScheduleState => ({
  schedule_enabled: true,
  schedule_times: ['08:00'],
  schedule_timezone: 'Asia/Taipei',
  last_scheduled_run_at: null,
  ...over,
});

// 08:00 Asia/Taipei === 00:00Z (no DST).
const justAfterSlot = new Date('2026-08-28T00:02:00.000Z');

describe('scheduleWindow', () => {
  it('exposes a tolerance window in minutes', () => {
    expect(SCHEDULE_TICK_TOLERANCE_MINUTES).toBeGreaterThan(0);
  });

  it('is not due when the schedule is disabled', () => {
    expect(isVendorDue(state({ schedule_enabled: false }), justAfterSlot)).toBe(false);
  });

  it('is not due when no times are configured', () => {
    expect(isVendorDue(state({ schedule_times: [] }), justAfterSlot)).toBe(false);
  });

  it('is due two minutes after a slot that never ran', () => {
    expect(isVendorDue(state(), justAfterSlot)).toBe(true);
  });

  it('returns the occurrence instant, not just a boolean', () => {
    expect(dueOccurrence(state(), justAfterSlot)?.toISOString()).toBe('2026-08-28T00:00:00.000Z');
  });

  it('is not due when the slot already ran', () => {
    const ran = state({ last_scheduled_run_at: '2026-08-28T00:01:00.000Z' });
    expect(isVendorDue(ran, justAfterSlot)).toBe(false);
  });

  it('is not due six hours after the slot even when it never ran', () => {
    expect(isVendorDue(state(), new Date('2026-08-28T06:00:00.000Z'))).toBe(false);
  });

  it('is not due six hours after the slot when the last run was yesterday', () => {
    const ran = state({ last_scheduled_run_at: '2026-08-27T00:05:00.000Z' });
    expect(isVendorDue(ran, new Date('2026-08-28T06:00:00.000Z'))).toBe(false);
  });

  it("finds yesterday's local slot just after local midnight", () => {
    // 23:58 Taipei on 2026-08-28 === 2026-08-28T15:58Z; now is 00:05 Taipei on 08-29.
    const late = state({ schedule_times: ['23:58'] });
    expect(isVendorDue(late, new Date('2026-08-28T16:05:00.000Z'))).toBe(true);
  });

  it('honours the vendor timezone', () => {
    expect(isVendorDue(state({ schedule_timezone: 'Asia/Taipei' }), justAfterSlot)).toBe(true);
    expect(isVendorDue(state({ schedule_timezone: 'UTC' }), justAfterSlot)).toBe(false);
  });

  it('picks the latest passed slot when several are configured', () => {
    const many = state({ schedule_times: ['08:00', '12:30', '18:30'] });
    // 12:32 Taipei === 04:32Z
    expect(dueOccurrence(many, new Date('2026-08-28T04:32:00.000Z'))?.toISOString()).toBe(
      '2026-08-28T04:30:00.000Z'
    );
  });

  it('does not throw on an invalid timezone', () => {
    expect(() => isVendorDue(state({ schedule_timezone: 'Not/AZone' }), justAfterSlot)).not.toThrow();
    expect(isVendorDue(state({ schedule_timezone: 'Not/AZone' }), justAfterSlot)).toBe(false);
  });
});
