import { format, parseISO, isValid } from 'date-fns';

export function formatDate(dateString?: string | null, formatStr = 'yyyy-MM-dd HH:mm'): string {
  if (!dateString) return '-';
  try {
    const parsed = parseISO(dateString);
    if (!isValid(parsed)) return '-';
    return format(parsed, formatStr);
  } catch {
    return '-';
  }
}

export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const parsed = parseISO(dateString);
    if (!isValid(parsed)) return '-';
    return format(parsed, 'yyyy-MM-dd');
  } catch {
    return '-';
  }
}
