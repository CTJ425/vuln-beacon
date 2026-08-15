import { describe, it, expect } from 'vitest';
import { calculateSeverityFromCvss, parseCvssVector, normalizeSeverity } from '@/utils/cvss';

describe('CVSS Utilities', () => {
  describe('calculateSeverityFromCvss', () => {
    it('should return CRITICAL for scores >= 9.0', () => {
      expect(calculateSeverityFromCvss(9.0)).toBe('CRITICAL');
      expect(calculateSeverityFromCvss(9.8)).toBe('CRITICAL');
      expect(calculateSeverityFromCvss(10.0)).toBe('CRITICAL');
    });

    it('should return HIGH for scores 7.0 - 8.9', () => {
      expect(calculateSeverityFromCvss(7.0)).toBe('HIGH');
      expect(calculateSeverityFromCvss(8.9)).toBe('HIGH');
    });

    it('should return MEDIUM for scores 4.0 - 6.9', () => {
      expect(calculateSeverityFromCvss(4.0)).toBe('MEDIUM');
      expect(calculateSeverityFromCvss(6.9)).toBe('MEDIUM');
    });

    it('should return LOW for scores 0.1 - 3.9', () => {
      expect(calculateSeverityFromCvss(0.1)).toBe('LOW');
      expect(calculateSeverityFromCvss(3.9)).toBe('LOW');
    });

    it('should return UNKNOWN for null, undefined, or out of range scores', () => {
      expect(calculateSeverityFromCvss(null)).toBe('UNKNOWN');
      expect(calculateSeverityFromCvss(undefined)).toBe('UNKNOWN');
      expect(calculateSeverityFromCvss(-1)).toBe('UNKNOWN');
    });
  });

  describe('normalizeSeverity', () => {
    it('should normalize strings to standard SeverityLevel', () => {
      expect(normalizeSeverity('critical')).toBe('CRITICAL');
      expect(normalizeSeverity('CRITICAL')).toBe('CRITICAL');
      expect(normalizeSeverity('important')).toBe('HIGH');
      expect(normalizeSeverity('High')).toBe('HIGH');
      expect(normalizeSeverity('moderate')).toBe('MEDIUM');
      expect(normalizeSeverity('medium')).toBe('MEDIUM');
      expect(normalizeSeverity('low')).toBe('LOW');
      expect(normalizeSeverity('invalid')).toBe('UNKNOWN');
    });
  });

  describe('parseCvssVector', () => {
    it('should parse CVSS 3.1 vector string into structured metrics', () => {
      const vector = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
      const parsed = parseCvssVector(vector);
      expect(parsed).toEqual({
        version: '3.1',
        AV: 'N',
        AC: 'L',
        PR: 'N',
        UI: 'N',
        S: 'U',
        C: 'H',
        I: 'H',
        A: 'H',
      });
    });

    it('should return null for invalid vector string', () => {
      expect(parseCvssVector('')).toBeNull();
      expect(parseCvssVector('invalid')).toBeNull();
    });
  });
});
