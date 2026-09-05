import { supabase } from '@/lib/supabase';

const getEnvKey = () =>
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  '';

/**
 * Resolves authorization headers for invoking Supabase Edge Functions.
 * Returns an explicit Authorization Bearer header (and apikey) using either
 * the current session's access_token or the client's publishable key.
 */
export async function getFunctionHeaders(): Promise<Record<string, string>> {
  let token = '';

  try {
    const session = await supabase?.auth?.getSession?.();
    if (session?.data?.session?.access_token) {
      token = session.data.session.access_token;
    }
  } catch {
    // Ignore error retrieving session
  }

  if (!token && (supabase as any)?.supabaseKey) {
    token = (supabase as any).supabaseKey;
  }

  if (!token) {
    token = getEnvKey();
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (token) {
    headers.apikey = token;
  }

  return headers;
}
