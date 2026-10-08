/**
 * Utility functions and configurations for product impact states across all vendors.
 */

import type { VulnStateTone } from '@/theme/tokens';

export interface StateBadgeConfig {
  label: string;
  /** Theme tone; StateBadge reads its colors from palette.vulnState[tone]. */
  tone: VulnStateTone;
}

export function getStateBadgeConfig(state?: string | null): StateBadgeConfig {
  const s = (state || '').toLowerCase().trim();

  if (s === 'affected' || s === 'open' || s === 'needed') {
    return { label: '🔴 受影響 (Affected)', tone: 'affected' };
  }
  if (s === 'will not fix' || s === 'wontfix') {
    return { label: '🔴 不予修復 (Will not fix)', tone: 'wontfix' };
  }
  if (s.includes('not affected') || s === 'not_affected') {
    return { label: '🟢 不受影響 (Not affected)', tone: 'notAffected' };
  }
  if (s === 'fixed' || s === 'resolved' || s === 'released') {
    return { label: '🟢 已修復 (Fixed)', tone: 'fixed' };
  }
  if (s === 'fix deferred' || s === 'fix_deferred') {
    return { label: '🟠 延後修復 (Fix deferred)', tone: 'deferred' };
  }
  if (s === 'under investigation') {
    return { label: '🟡 調查中 (Under investigation)', tone: 'investigating' };
  }
  if (!s || s === '-' || s === 'unknown') {
    return { label: '未指定 (Unknown)', tone: 'unknown' };
  }
  return { label: state || '', tone: 'unknown' };
}

export function matchesImpactState(impState: string | undefined | null, selectedStatus: string): boolean {
  if (!selectedStatus || selectedStatus === 'ALL') return true;
  const s = (impState || '').toLowerCase().trim();
  if (!s) return false;

  switch (selectedStatus) {
    case 'AFFECTED':
      if (s.includes('not affected') || s === 'not_affected') return false;
      return (
        s === 'affected' ||
        s === 'open' ||
        s === 'needed' ||
        s === 'will not fix' ||
        s === 'wontfix'
      );
    case 'NOT_AFFECTED':
      return s.includes('not affected') || s === 'not_affected';
    case 'FIXED':
      return s === 'fixed' || s === 'resolved' || s === 'released';
    case 'FIX_DEFERRED':
      return s === 'fix deferred' || s === 'fix_deferred' || s === 'under investigation';
    default: {
      const normS = s.replace(/[\s_-]/g, '');
      const normTarget = selectedStatus.toLowerCase().replace(/[\s_-]/g, '');
      return normS === normTarget;
    }
  }
}

export function isAffectedState(state?: string | null): boolean {
  const s = (state || '').toLowerCase().trim();
  if (s.includes('not affected') || s === 'not_affected') return false;
  return s === 'affected' || s === 'will not fix' || s === 'wontfix' || s === 'open' || s === 'needed';
}
