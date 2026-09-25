import packageJson from '../package.json';

/**
 * Current application version sourced directly from src/package.json.
 * Fallback to '1.3.0-dev.4' if version is not resolved.
 */
export const APP_VERSION: string = packageJson.version || '1.3.0-dev.4';

/**
 * Current application package name.
 */
export const APP_NAME: string = packageJson.name || 'vuln-beacon';

/**
 * Returns the version string formatted with a prefix (default 'v').
 * Example: 'v1.0.0-dev.5'
 */
export const getDisplayVersion = (prefix: string = 'v'): string => {
  if (!APP_VERSION) return '';
  return APP_VERSION.startsWith(prefix) ? APP_VERSION : `${prefix}${APP_VERSION}`;
};
