import { describe, it, expect } from 'vitest';
import { getAdvisoryUrl } from '@/utils/advisoryUrl';

describe('getAdvisoryUrl utility', () => {
  it('returns empty string for empty, null, or placeholder dash advisory', () => {
    expect(getAdvisoryUrl('')).toBe('');
    expect(getAdvisoryUrl('-')).toBe('');
    expect(getAdvisoryUrl('   ')).toBe('');
  });

  it('preserves existing absolute URLs without double-encoding', () => {
    expect(getAdvisoryUrl('https://portal.nutanix.com/page/details?id=NXSA-1234', 'nutanix')).toBe(
      'https://portal.nutanix.com/page/details?id=NXSA-1234'
    );
    expect(getAdvisoryUrl('http://security.debian.org/dsa-123')).toBe(
      'http://security.debian.org/dsa-123'
    );
  });

  it('resolves CVE identifiers to appropriate vendor or global tracker', () => {
    expect(getAdvisoryUrl('CVE-2026-1001', 'redhat')).toBe(
      'https://access.redhat.com/security/cve/CVE-2026-1001'
    );
    expect(getAdvisoryUrl('CVE-2026-1002', 'ubuntu')).toBe(
      'https://ubuntu.com/security/cve/CVE-2026-1002'
    );
    expect(getAdvisoryUrl('CVE-2026-1003', 'debian')).toBe(
      'https://security-tracker.debian.org/tracker/CVE-2026-1003'
    );
    expect(getAdvisoryUrl('CVE-2026-1004', 'suse')).toBe(
      'https://www.suse.com/security/cve/CVE-2026-1004'
    );
    expect(getAdvisoryUrl('CVE-2026-1005')).toBe(
      'https://www.cve.org/CVERecord?id=CVE-2026-1005'
    );
  });

  it('resolves Nutanix advisory URL correctly', () => {
    expect(getAdvisoryUrl('NXSA-2026.01')).toBe(
      'https://portal.nutanix.com/page/documents/security-advisories/release-advisories/details?id=NXSA-2026.01'
    );
    expect(getAdvisoryUrl('SEC-1234', 'nutanix')).toBe(
      'https://portal.nutanix.com/page/documents/security-advisories/release-advisories/details?id=SEC-1234'
    );
  });

  it('resolves Ubuntu security notice URL correctly', () => {
    expect(getAdvisoryUrl('USN-7000-1')).toBe(
      'https://ubuntu.com/security/notices/USN-7000-1'
    );
    expect(getAdvisoryUrl('LSN-0099-1')).toBe(
      'https://ubuntu.com/security/notices/LSN-0099-1'
    );
    expect(getAdvisoryUrl('notice-123', 'ubuntu')).toBe(
      'https://ubuntu.com/security/notices/notice-123'
    );
  });

  it('resolves Debian security tracker URL correctly', () => {
    expect(getAdvisoryUrl('DSA-5700-1')).toBe(
      'https://security-tracker.debian.org/tracker/DSA-5700-1'
    );
    expect(getAdvisoryUrl('DLA-3800-1')).toBe(
      'https://security-tracker.debian.org/tracker/DLA-3800-1'
    );
    expect(getAdvisoryUrl('DEBIAN-2026', 'debian')).toBe(
      'https://security-tracker.debian.org/tracker/DEBIAN-2026'
    );
  });

  it('resolves SUSE specific announcement URL when regex matches', () => {
    expect(getAdvisoryUrl('SUSE-SU-2026:3952-1')).toBe(
      'https://www.suse.com/support/update/announcement/2026/suse-su-20263952-1/'
    );
    expect(getAdvisoryUrl('SUSE-RU-2026:1234-1')).toBe(
      'https://www.suse.com/support/update/announcement/2026/suse-ru-20261234-1/'
    );
    expect(getAdvisoryUrl('suse-su-2026-3951-1')).toBe(
      'https://www.suse.com/support/update/announcement/2026/suse-su-20263951-1/'
    );
    expect(getAdvisoryUrl('SUSE-SU-OTHER', 'suse')).toBe(
      'https://www.suse.com/support/update/announcement/'
    );
  });

  it('resolves Red Hat errata URL', () => {
    expect(getAdvisoryUrl('RHSA-2026:1001')).toBe(
      'https://access.redhat.com/errata/RHSA-2026:1001'
    );
    expect(getAdvisoryUrl('RHBA-2026:2002', 'redhat')).toBe(
      'https://access.redhat.com/errata/RHBA-2026:2002'
    );
    expect(getAdvisoryUrl('RHEA-2026:3003')).toBe(
      'https://access.redhat.com/errata/RHEA-2026:3003'
    );
  });

  it('returns empty string for unclassified advisory string without vendor', () => {
    expect(getAdvisoryUrl('UNCLASSIFIED-ID-999')).toBe('');
  });
});
