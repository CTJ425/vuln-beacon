import { supabase } from '@/lib/supabase';
import { Vendor } from '@/types';

export class VendorService {
  async fetchVendors(): Promise<Vendor[]> {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('Error fetching vendors:', error.message);
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        icon_url: row.icon_url,
        homepage: row.homepage,
        is_active: row.is_active,
        created_at: row.created_at,
        schedule_enabled: row.schedule_enabled ?? false,
        schedule_times: row.schedule_times ?? [],
        schedule_timezone: row.schedule_timezone ?? 'Asia/Taipei',
        last_scheduled_run_at: row.last_scheduled_run_at ?? null,
      }));
    } catch (err) {
      console.error('Failed to fetch vendors:', err);
      return [];
    }
  }

  async updateSchedule(
    vendorCode: string,
    schedule: { enabled: boolean; times: string[]; timezone: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('sync-cve', {
        body: { action: 'update_vendor_schedule', vendorCode, schedule },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        return { success: false, error: data?.error || 'Failed to update schedule' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update schedule' };
    }
  }
}
