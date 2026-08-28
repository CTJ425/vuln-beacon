import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOrder = vi.fn();
const mockSelect = vi.fn(() => ({ order: mockOrder }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockInvoke = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...(args as [])),
    functions: { invoke: (...args: any[]) => mockInvoke(...(args as [])) },
  },
}));

import { VendorService } from '@/services/vendorService';

const baseRow = {
  id: 'id-redhat',
  code: 'redhat',
  name: 'Red Hat',
  icon_url: null,
  homepage: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('VendorService schedule support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('maps the schedule columns from the vendors row', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          ...baseRow,
          schedule_enabled: true,
          schedule_times: ['08:00', '12:30'],
          schedule_timezone: 'Asia/Taipei',
          last_scheduled_run_at: '2026-08-28T00:00:00.000Z',
        },
      ],
      error: null,
    });

    const vendors = await new VendorService().fetchVendors();

    expect(vendors[0].schedule_enabled).toBe(true);
    expect(vendors[0].schedule_times).toEqual(['08:00', '12:30']);
    expect(vendors[0].schedule_timezone).toBe('Asia/Taipei');
    expect(vendors[0].last_scheduled_run_at).toBe('2026-08-28T00:00:00.000Z');
  });

  it('applies defaults when the schedule columns are absent', async () => {
    mockOrder.mockResolvedValue({ data: [baseRow], error: null });

    const vendors = await new VendorService().fetchVendors();

    expect(vendors[0].schedule_enabled).toBe(false);
    expect(vendors[0].schedule_times).toEqual([]);
    expect(vendors[0].schedule_timezone).toBe('Asia/Taipei');
    expect(vendors[0].last_scheduled_run_at).toBeNull();
  });

  it('sends the schedule through the sync-cve edge function', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, vendor: baseRow }, error: null });

    const result = await new VendorService().updateSchedule('redhat', {
      enabled: true,
      times: ['08:00', '18:30'],
      timezone: 'Asia/Taipei',
    });

    expect(result.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [fnName, options] = mockInvoke.mock.calls[0] as [string, any];
    expect(fnName).toBe('sync-cve');
    expect(options.body.action).toBe('update_vendor_schedule');
    expect(options.body.vendorCode).toBe('redhat');
    expect(options.body.schedule).toEqual({
      enabled: true,
      times: ['08:00', '18:30'],
      timezone: 'Asia/Taipei',
    });
  });

  it('returns a failure result instead of throwing on a transport error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const result = await new VendorService().updateSchedule('redhat', {
      enabled: false,
      times: [],
      timezone: 'Asia/Taipei',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');
  });

  it('surfaces a validation error returned in the response body', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: 'Invalid schedule time' },
      error: null,
    });

    const result = await new VendorService().updateSchedule('redhat', {
      enabled: true,
      times: ['25:00'],
      timezone: 'Asia/Taipei',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid schedule time');
  });
});
