import { describe, it, expect } from 'vitest';
import { getStateBadgeConfig, matchesImpactState, isAffectedState } from '@/utils/statusUtils';

describe('statusUtils', () => {
  describe('matchesImpactState', () => {
    it('returns true when selectedStatus is ALL or empty', () => {
      expect(matchesImpactState('Affected', 'ALL')).toBe(true);
      expect(matchesImpactState('Not affected', 'ALL')).toBe(true);
      expect(matchesImpactState('Fixed', '')).toBe(true);
    });

    it('returns false for empty or null impact states when filtering', () => {
      expect(matchesImpactState('', 'AFFECTED')).toBe(false);
      expect(matchesImpactState(null, 'AFFECTED')).toBe(false);
      expect(matchesImpactState(undefined, 'AFFECTED')).toBe(false);
    });

    it('accurately distinguishes AFFECTED from NOT_AFFECTED without substring collision', () => {
      // Critical check: "Not affected" must NOT match AFFECTED filter
      expect(matchesImpactState('Not affected', 'AFFECTED')).toBe(false);
      expect(matchesImpactState('not_affected', 'AFFECTED')).toBe(false);

      // Affected states match AFFECTED
      expect(matchesImpactState('Affected', 'AFFECTED')).toBe(true);
      expect(matchesImpactState('open', 'AFFECTED')).toBe(true);
      expect(matchesImpactState('needed', 'AFFECTED')).toBe(true);
      expect(matchesImpactState('Will not fix', 'AFFECTED')).toBe(true);
      expect(matchesImpactState('wontfix', 'AFFECTED')).toBe(true);

      // Critical check: "Affected" must NOT match NOT_AFFECTED filter
      expect(matchesImpactState('Affected', 'NOT_AFFECTED')).toBe(false);
      expect(matchesImpactState('Not affected', 'NOT_AFFECTED')).toBe(true);
      expect(matchesImpactState('not_affected', 'NOT_AFFECTED')).toBe(true);
    });

    it('correctly matches FIXED and FIX_DEFERRED states across multi-vendor terminology', () => {
      expect(matchesImpactState('Fixed', 'FIXED')).toBe(true);
      expect(matchesImpactState('resolved', 'FIXED')).toBe(true);
      expect(matchesImpactState('released', 'FIXED')).toBe(true);
      expect(matchesImpactState('Affected', 'FIXED')).toBe(false);

      expect(matchesImpactState('Fix deferred', 'FIX_DEFERRED')).toBe(true);
      expect(matchesImpactState('fix_deferred', 'FIX_DEFERRED')).toBe(true);
      expect(matchesImpactState('under investigation', 'FIX_DEFERRED')).toBe(true);
      expect(matchesImpactState('Fixed', 'FIX_DEFERRED')).toBe(false);
    });
  });

  describe('isAffectedState', () => {
    it('returns true for active vulnerability states and false for mitigated/not-affected states', () => {
      expect(isAffectedState('Affected')).toBe(true);
      expect(isAffectedState('open')).toBe(true);
      expect(isAffectedState('needed')).toBe(true);
      expect(isAffectedState('Will not fix')).toBe(true);
      expect(isAffectedState('wontfix')).toBe(true);

      expect(isAffectedState('Not affected')).toBe(false);
      expect(isAffectedState('not_affected')).toBe(false);
      expect(isAffectedState('Fixed')).toBe(false);
      expect(isAffectedState('resolved')).toBe(false);
      expect(isAffectedState(null)).toBe(false);
    });
  });

  describe('getStateBadgeConfig', () => {
    it('provides distinct colors and labels for each state', () => {
      expect(getStateBadgeConfig('Affected').label).toBe('🔴 受影響 (Affected)');
      expect(getStateBadgeConfig('Not affected').label).toBe('🟢 不受影響 (Not affected)');
      expect(getStateBadgeConfig('Fixed').label).toBe('🟢 已修復 (Fixed)');
      expect(getStateBadgeConfig('Fix deferred').label).toBe('🟠 延後修復 (Fix deferred)');
      expect(getStateBadgeConfig('Will not fix').label).toBe('🔴 不予修復 (Will not fix)');
      expect(getStateBadgeConfig('under investigation').label).toBe('🟡 調查中 (Under investigation)');
      expect(getStateBadgeConfig(null).label).toBe('未指定 (Unknown)');
      expect(getStateBadgeConfig('').label).toBe('未指定 (Unknown)');
    });
  });
});
