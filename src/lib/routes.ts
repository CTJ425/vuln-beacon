import type { NavState } from '@/components/common/Sidebar';

// Admin Console tabs in display order; the index is the AdminPage tab index.
export const ADMIN_TABS = ['webhooks', 'sync', 'logs', 'health'] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

export type AppRoute =
  | { page: 'dashboard' }
  | { page: 'explorer' }
  | { page: 'vendor'; vendorCode: string }
  | { page: 'admin'; tab: AdminTab }
  | { page: 'advisory'; advisoryId: string }
  | { page: 'cve'; cveId: string }
  | { page: 'notFound' };

const NOT_FOUND: AppRoute = { page: 'notFound' };

const decode = (segment: string): string | null => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
};

export const parsePath = (pathname: string): AppRoute => {
  const segments = pathname.split('/').filter(Boolean);
  const [head, param, ...rest] = segments;

  if (segments.length === 0) return { page: 'dashboard' };
  if (head === 'explorer' && segments.length === 1) return { page: 'explorer' };

  if (head === 'admin' && rest.length === 0) {
    if (param === undefined) return { page: 'admin', tab: ADMIN_TABS[0] };
    const tab = ADMIN_TABS.find((t) => t === param);
    return tab ? { page: 'admin', tab } : NOT_FOUND;
  }

  if (param === undefined || rest.length > 0) return NOT_FOUND;
  const value = decode(param);
  if (value === null) return NOT_FOUND;

  if (head === 'vendors') return { page: 'vendor', vendorCode: value };
  if (head === 'advisories') return { page: 'advisory', advisoryId: value };
  if (head === 'cves') return { page: 'cve', cveId: value };
  return NOT_FOUND;
};

export const pathFor = (route: AppRoute): string => {
  switch (route.page) {
    case 'dashboard':
    case 'notFound':
      return '/';
    case 'explorer':
      return '/explorer';
    case 'vendor':
      return `/vendors/${encodeURIComponent(route.vendorCode)}`;
    case 'admin':
      return route.tab === ADMIN_TABS[0] ? '/admin' : `/admin/${route.tab}`;
    case 'advisory':
      return `/advisories/${encodeURIComponent(route.advisoryId)}`;
    case 'cve':
      return `/cves/${encodeURIComponent(route.cveId)}`;
  }
};

export const pathForNav = (nav: NavState): string => {
  switch (nav.section) {
    case 'dashboard':
      return '/';
    case 'explorer':
      return '/explorer';
    case 'vendor':
      return pathFor({ page: 'vendor', vendorCode: nav.vendorCode });
    case 'admin':
      return '/admin';
    case 'settings':
      return '/admin/webhooks';
    case 'sync':
      return '/admin/sync';
  }
};
