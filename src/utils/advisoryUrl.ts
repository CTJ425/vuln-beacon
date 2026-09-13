/**
 * Utility for resolving canonical advisory, errata, and CVE URLs across supported enterprise vendors.
 */

export function getAdvisoryUrl(advisoryId: string, vendorCode?: string): string {
  const adv = (advisoryId || '').trim();
  if (!adv || adv === '-') return '';

  // If already a valid absolute URL, return directly
  if (/^https?:\/\//i.test(adv)) {
    return adv;
  }

  const v = (vendorCode || '').toLowerCase().trim();

  // If input is a standard CVE identifier (e.g. CVE-2024-1234)
  if (/^CVE-\d{4}-\d+$/i.test(adv)) {
    const cveUpper = adv.toUpperCase();
    if (v === 'redhat') {
      return `https://access.redhat.com/security/cve/${cveUpper}`;
    }
    if (v === 'ubuntu') {
      return `https://ubuntu.com/security/cve/${cveUpper}`;
    }
    if (v === 'debian') {
      return `https://security-tracker.debian.org/tracker/${cveUpper}`;
    }
    if (v === 'suse') {
      return `https://www.suse.com/security/cve/${cveUpper}`;
    }
    if (v === 'nutanix') {
      return `https://portal.nutanix.com/page/documents/security-advisories/release-advisories/details?id=${encodeURIComponent(adv)}`;
    }
    if (v === 'cisco') {
      return `https://sec.cloudapps.cisco.com/security/center/cveListing.x?cve=${cveUpper}`;
    }
    if (v === 'vmware') {
      return `https://nvd.nist.gov/vuln/detail/${cveUpper}`;
    }
    return `https://www.cve.org/CVERecord?id=${encodeURIComponent(cveUpper)}`;
  }

  // Nutanix advisories: NXSA-... or nutanix vendor
  if (adv.toUpperCase().startsWith('NXSA-') || v === 'nutanix') {
    return `https://portal.nutanix.com/page/documents/security-advisories/release-advisories/details?id=${encodeURIComponent(adv)}`;
  }

  // Ubuntu security notices: USN-..., LSN-... or ubuntu vendor
  if (adv.toUpperCase().startsWith('USN-') || adv.toUpperCase().startsWith('LSN-') || v === 'ubuntu') {
    return `https://ubuntu.com/security/notices/${encodeURIComponent(adv)}`;
  }

  // Debian security advisories: DSA-..., DLA-..., DEBIAN-... or debian vendor
  if (
    adv.toUpperCase().startsWith('DSA-') ||
    adv.toUpperCase().startsWith('DLA-') ||
    adv.toUpperCase().startsWith('DEBIAN-') ||
    v === 'debian'
  ) {
    return `https://security-tracker.debian.org/tracker/${encodeURIComponent(adv)}`;
  }

  // SUSE security announcements: SUSE-SU-..., SUSE-RU-..., OPENSUSE-SU-... or suse vendor
  if (
    adv.toUpperCase().startsWith('SUSE-SU-') ||
    adv.toUpperCase().startsWith('SUSE-RU-') ||
    adv.toUpperCase().startsWith('OPENSUSE-SU-') ||
    v === 'suse'
  ) {
    const m = adv.match(/^(suse|opensuse)-(su|ru)-(\d{4})[:\-_](\d+)-(\d+)$/i);
    if (m && m[1].toLowerCase() === 'suse') {
      const type = m[2].toLowerCase();
      const year = m[3];
      const id = m[4];
      const rev = m[5];
      return `https://www.suse.com/support/update/announcement/${year}/suse-${type}-${year}${id}-${rev}/`;
    }
    return 'https://www.suse.com/support/update/announcement/';
  }

  // Red Hat Errata: RHSA-..., RHBA-..., RHEA-... or redhat vendor
  if (
    adv.toUpperCase().startsWith('RHSA-') ||
    adv.toUpperCase().startsWith('RHBA-') ||
    adv.toUpperCase().startsWith('RHEA-') ||
    v === 'redhat'
  ) {
    return `https://access.redhat.com/errata/${adv}`;
  }

  // Cisco security advisories: cisco-sa-... or cisco vendor
  if (/^cisco-sa-/i.test(adv) || v === 'cisco') {
    return `https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/${adv}`;
  }

  // VMware / Broadcom advisories: VMSA-... or vmware vendor. There is no detail
  // endpoint or per-advisory URL pattern from the id alone, so fall back to the list.
  if (adv.toUpperCase().startsWith('VMSA-') || v === 'vmware') {
    return 'https://support.broadcom.com/web/ecx/security-advisories';
  }

  return '';
}
