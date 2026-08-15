import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Database Schema Smoke Test', () => {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20260815000000_init_cve_collector.sql');

  it('should have the primary initial migration file present', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('should define all 7 required core tables in the migration script', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    const expectedTables = [
      'public.vendors',
      'public.advisories',
      'public.cves',
      'public.advisory_cve_map',
      'public.cve_triage',
      'public.vendor_sync_logs',
      'public.webhook_configs',
    ];

    for (const table of expectedTables) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('should enable Row Level Security (RLS) on all tables', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    const tables = [
      'public.vendors',
      'public.advisories',
      'public.cves',
      'public.advisory_cve_map',
      'public.cve_triage',
      'public.vendor_sync_logs',
      'public.webhook_configs',
    ];

    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('should include seed data for all 8 target vendors', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    const vendors = ['redhat', 'vmware', 'nutanix', 'dell', 'hpe', 'netapp', 'veeam', 'cohesity'];

    for (const code of vendors) {
      expect(sql).toContain(`'${code}'`);
    }
  });
});
