/**
 * Utility for resolving canonical advisory and errata URLs across supported enterprise vendors.
 */

export function getAdvisoryUrl(advisoryId: string, vendorCode?: string): string {
  const adv = (advisoryId || '').trim();
  if (!adv || adv === '-') return '';
  const v = (vendorCode || '').toLowerCase();

  // Nutanix advisories: NXSA-... or nutanix vendor
  if (adv.toUpperCase().startsWith('NXSA-') || v === 'nutanix') {
    return `https://portal.nutanix.com/page/documents/security-advisories/release-advisories/details?id=${encodeURIComponent(adv)}`;
  }

  // Ubuntu security notices: USN-..., LSN-... or ubuntu vendor
  if (adv.toUpperCase().startsWith('USN-') || adv.toUpperCase().startsWith('LSN-') || v === 'ubuntu') {
    return `https://ubuntu.com/security/notices/${encodeURIComponent(adv)}`;
  }

  // Debian security advisories: DSA-..., DLA-..., DEBIAN-... or debian vendor
  if (adv.toUpperCase().startsWith('DSA-') || adv.toUpperCase().startsWith('DLA-') || adv.toUpperCase().startsWith('DEBIAN-') || v === 'debian') {
    return `https://security-tracker.debian.org/tracker/${encodeURIComponent(adv)}`;
  }

  // SUSE security announcements: SUSE-SU-..., OPENSUSE-SU-... or suse vendor
  if (adv.toUpperCase().startsWith('SUSE-SU-') || adv.toUpperCase().startsWith('OPENSUSE-SU-') || v === 'suse') {
    const m = adv.match(/^(suse|opensuse)-su-(\d{4})[:\-_](\d+)-(\d+)$/i);
    if (m && m[1].toLowerCase() === 'suse') {
      return `https://www.suse.com/support/update/announcement/${m[2]}/suse-su-${m[2]}${m[3]}-${m[4]}/`;
    }
    return 'https://www.suse.com/support/update/announcement/';
  }

  // Red Hat Errata (default for RHSA-..., RHBA-..., RHEA-... or generic enterprise advisories)
  return `https://access.redhat.com/errata/${adv}`;
}
