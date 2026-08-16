import { supabase } from '@/lib/supabase';
import { WebhookConfig } from '@/types';
import { WebhookService } from '@/services/webhook';

export class WebhookConfigService {
  private webhookDispatcher = new WebhookService();

  async fetchWebhooks(): Promise<WebhookConfig[]> {
    try {
      const { data, error } = await supabase
        .from('webhook_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching webhook configs:', error.message);
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        platform: row.platform,
        webhook_url: row.webhook_url,
        min_severity: row.min_severity,
        is_active: row.is_active,
        created_at: row.created_at,
      }));
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
      return [];
    }
  }

  async createWebhook(
    webhook: Omit<WebhookConfig, 'id' | 'created_at'>
  ): Promise<WebhookConfig | null> {
    try {
      const { data, error } = await supabase
        .from('webhook_configs')
        .insert({
          name: webhook.name,
          platform: webhook.platform,
          webhook_url: webhook.webhook_url,
          min_severity: webhook.min_severity,
          is_active: webhook.is_active ?? true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting webhook:', error.message);
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        platform: data.platform,
        webhook_url: data.webhook_url,
        min_severity: data.min_severity,
        is_active: data.is_active,
        created_at: data.created_at,
      };
    } catch (err) {
      console.error('Failed to create webhook:', err);
      return null;
    }
  }

  async deleteWebhook(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('webhook_configs')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting webhook:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Failed to delete webhook:', err);
      return false;
    }
  }

  async testWebhook(webhook: WebhookConfig): Promise<boolean> {
    return this.webhookDispatcher.dispatch(
      webhook,
      {
        vendorName: 'VulnBeacon Live Dispatcher',
        advisoryId: 'TEST-ALERT-001',
        advisoryTitle: 'Live Supabase Webhook Integration Test',
        advisoryUrl: 'https://github.com/cve-collector/vuln-beacon',
        cveId: 'CVE-2026-LIVE-TEST',
        cvssScore: 9.8,
        severity: 'CRITICAL',
        summary: 'Verified live delivery from VulnBeacon connected to Supabase backend.',
      },
      { ignoreActiveState: true }
    );
  }
}
