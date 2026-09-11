/**
 * Utility functions and configurations for product impact states across all vendors.
 */

export interface StateBadgeConfig {
  label: string;
  color: string;
  bg: string;
  border?: string;
}

export function getStateBadgeConfig(state?: string | null): StateBadgeConfig {
  const s = (state || '').toLowerCase().trim();

  if (s === 'affected' || s === 'open' || s === 'needed') {
    return {
      label: '🔴 受影響 (Affected)',
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.15)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
    };
  }

  if (s === 'will not fix' || s === 'wontfix') {
    return {
      label: '🔴 不予修復 (Will not fix)',
      color: '#f87171',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: '1px solid rgba(239, 68, 68, 0.25)',
    };
  }

  if (s.includes('not affected') || s === 'not_affected') {
    return {
      label: '🟢 不受影響 (Not affected)',
      color: '#22c55e',
      bg: 'rgba(34, 197, 94, 0.15)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
    };
  }

  if (s === 'fixed' || s === 'resolved' || s === 'released') {
    return {
      label: '🟢 已修復 (Fixed)',
      color: '#22c55e',
      bg: 'rgba(34, 197, 94, 0.15)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
    };
  }

  if (s === 'fix deferred' || s === 'fix_deferred') {
    return {
      label: '🟠 延後修復 (Fix deferred)',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.15)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
    };
  }

  if (s === 'under investigation') {
    return {
      label: '🟡 調查中 (Under investigation)',
      color: '#eab308',
      bg: 'rgba(234, 179, 8, 0.15)',
      border: '1px solid rgba(234, 179, 8, 0.3)',
    };
  }

  if (!s || s === '-' || s === 'unknown') {
    return {
      label: '未指定 (Unknown)',
      color: 'text.secondary',
      bg: 'action.hover',
    };
  }

  return {
    label: state || '',
    color: 'text.secondary',
    bg: 'action.hover',
  };
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
