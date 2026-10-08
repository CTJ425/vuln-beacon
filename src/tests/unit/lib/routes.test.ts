import { describe, it, expect } from 'vitest';
import { parsePath, pathFor, pathForNav, ADMIN_TABS } from '@/lib/routes';

describe('routes', () => {
  describe('parsePath', () => {
    it('should map the root path to the dashboard', () => {
      expect(parsePath('/')).toEqual({ page: 'dashboard' });
    });

    it('should map /explorer to the explorer and ignore a trailing slash', () => {
      expect(parsePath('/explorer')).toEqual({ page: 'explorer' });
      expect(parsePath('/explorer/')).toEqual({ page: 'explorer' });
    });

    it('should map /vendors/:code to the vendor page', () => {
      expect(parsePath('/vendors/redhat')).toEqual({ page: 'vendor', vendorCode: 'redhat' });
    });

    it('should map /admin to the first admin tab and /admin/:tab to that tab', () => {
      expect(parsePath('/admin')).toEqual({ page: 'admin', tab: 'webhooks' });
      expect(parsePath('/admin/sync')).toEqual({ page: 'admin', tab: 'sync' });
      expect(parsePath('/admin/health')).toEqual({ page: 'admin', tab: 'health' });
    });

    it('should treat an unknown admin tab as not found', () => {
      expect(parsePath('/admin/nope')).toEqual({ page: 'notFound' });
    });

    it('should decode advisory IDs that contain reserved characters', () => {
      expect(parsePath('/advisories/RHSA-2026%3A1234')).toEqual({ page: 'advisory', advisoryId: 'RHSA-2026:1234' });
    });

    it('should map /cves/:id to the CVE detail', () => {
      expect(parsePath('/cves/CVE-2026-1001')).toEqual({ page: 'cve', cveId: 'CVE-2026-1001' });
    });

    it('should return notFound for an unknown path or a malformed escape', () => {
      expect(parsePath('/nowhere')).toEqual({ page: 'notFound' });
      expect(parsePath('/cves/%E0%A4%A')).toEqual({ page: 'notFound' });
    });
  });

  describe('pathFor', () => {
    it('should round-trip every route through parsePath', () => {
      const routes = [
        { page: 'dashboard' as const },
        { page: 'explorer' as const },
        { page: 'vendor' as const, vendorCode: 'vmware' },
        ...ADMIN_TABS.map((tab) => ({ page: 'admin' as const, tab })),
        { page: 'advisory' as const, advisoryId: 'RHSA-2026:1234' },
        { page: 'cve' as const, cveId: 'CVE-2026-1001' },
      ];
      for (const route of routes) {
        expect(parsePath(pathFor(route))).toEqual(route);
      }
    });

    it('should encode reserved characters in advisory IDs', () => {
      expect(pathFor({ page: 'advisory', advisoryId: 'RHSA-2026:1234' })).toBe('/advisories/RHSA-2026%3A1234');
    });
  });

  describe('pathForNav', () => {
    it('should map sidebar navigation states to paths, including the legacy admin sections', () => {
      expect(pathForNav({ section: 'dashboard' })).toBe('/');
      expect(pathForNav({ section: 'explorer' })).toBe('/explorer');
      expect(pathForNav({ section: 'vendor', vendorCode: 'cisco' })).toBe('/vendors/cisco');
      expect(pathForNav({ section: 'admin' })).toBe('/admin');
      expect(pathForNav({ section: 'settings' })).toBe('/admin/webhooks');
      expect(pathForNav({ section: 'sync' })).toBe('/admin/sync');
    });
  });
});
