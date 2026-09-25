// Admin is an explicit grant, not "any signed-in user": app_metadata can only
// be written with the service-role key, so a user cannot promote themselves.
// Shared by the browser and, via ingest.bundle.js, the sync-cve Edge Function.
export const ADMIN_ROLE = 'admin';

export function isAdminUser(user: unknown): boolean {
  return (user as { app_metadata?: { role?: unknown } } | null | undefined)?.app_metadata?.role === ADMIN_ROLE;
}

type GetUser = (token: string) => Promise<{ data: { user: unknown } | null; error: unknown }>;

export async function authorizeAdminRequest(
  authHeader: string | null | undefined,
  { serviceRoleKey, getUser }: { serviceRoleKey: string; getUser: GetUser }
): Promise<boolean> {
  const token = (authHeader ?? '').replace(/^bearer\s+/i, '').trim();
  if (!token) return false;
  if (serviceRoleKey && token === serviceRoleKey) return true;
  try {
    const { data, error } = await getUser(token);
    return !error && isAdminUser(data?.user);
  } catch {
    return false;
  }
}
