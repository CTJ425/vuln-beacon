// Source catalog: every UI string key lives here first. Vendor advisory text,
// CVE IDs and product names are data and are never translated.
export const en = {
  'nav.overview': 'Overview',
  'nav.explorer': 'CVE Explorer',
  'nav.sync': 'Sync Monitor',
  'nav.settings': 'Webhooks & Config',
  'nav.admin': 'Admin Console',
  'nav.primary': 'Primary',
  'sidebar.collapse': 'Collapse sidebar',
  'sidebar.expand': 'Expand sidebar',
  'header.github': 'GitHub repository',
  'theme.toLight': 'Switch to light theme',
  'theme.toDark': 'Switch to dark theme',
  'language.label': 'Language',
  'state.loading': 'Loading security data…',
  'state.loadError': 'Unable to load security data from Supabase. Check the connection and try again.',
  'state.retry': 'Retry',
  'state.empty':
    'The database is connected but has no advisories yet. Sign in to the Admin Console to run the first sync.',
  'state.goToAdmin': 'Go to Admin Console',
  'state.notFoundTitle': 'Page Not Found',
  'state.notFoundBody': 'This address does not match any page.',
  'detail.advisoryMissing': 'Advisory {id} was not found.',
  'detail.cveMissing': 'CVE {id} was not found.',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
