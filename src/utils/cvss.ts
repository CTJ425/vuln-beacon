import { SeverityLevel } from '@/types';

/**
 * Maps a numeric CVSS v3 score (0.0 - 10.0) to standard severity rating
 */
export function calculateSeverityFromCvss(score?: number | null): SeverityLevel {
  if (score === undefined || score === null || isNaN(score) || score < 0 || score > 10) {
    return 'UNKNOWN';
  }
  if (score >= 9.0) return 'CRITICAL';
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  if (score > 0.0) return 'LOW';
  return 'UNKNOWN';
}

/**
 * Normalizes vendor severity strings into standardized SeverityLevel enum
 */
export function normalizeSeverity(severityStr?: string | null): SeverityLevel {
  if (!severityStr) return 'UNKNOWN';
  const clean = severityStr.trim().toUpperCase();

  if (clean === 'CRITICAL' || clean === 'CRIT') return 'CRITICAL';
  if (clean === 'HIGH' || clean === 'IMPORTANT' || clean === 'SEVERE') return 'HIGH';
  if (clean === 'MEDIUM' || clean === 'MODERATE' || clean === 'MED') return 'MEDIUM';
  if (clean === 'LOW' || clean === 'MINOR') return 'LOW';
  return 'UNKNOWN';
}

/**
 * Parses a standard CVSS v3/v3.1 vector string into structured metrics
 */
export function parseCvssVector(vector?: string | null): Record<string, string> | null {
  if (!vector || !vector.startsWith('CVSS:3.')) {
    return null;
  }

  const parts = vector.split('/');
  const result: Record<string, string> = {};

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === 0 && part.startsWith('CVSS:')) {
      result.version = part.replace('CVSS:', '');
      continue;
    }
    const [key, value] = part.split(':');
    if (key && value) {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 1 ? result : null;
}
