import { describe, it, expect, vi } from 'vitest';
import { isAdminUser, authorizeAdminRequest } from '@/lib/adminAuth';

describe('isAdminUser', () => {
  it('accepts a user whose app_metadata.role is admin', () => {
    expect(isAdminUser({ app_metadata: { role: 'admin' } })).toBe(true);
  });

  it('rejects a signed-in user without the admin role', () => {
    expect(isAdminUser({ app_metadata: {} })).toBe(false);
    expect(isAdminUser({ app_metadata: { role: 'viewer' } })).toBe(false);
  });

  it('ignores user_metadata, which the user can edit', () => {
    expect(isAdminUser({ user_metadata: { role: 'admin' } })).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
  });
});

describe('authorizeAdminRequest', () => {
  const serviceRoleKey = 'service-role-secret';

  it('accepts the service-role key without a user lookup', async () => {
    const getUser = vi.fn();
    const ok = await authorizeAdminRequest(`Bearer ${serviceRoleKey}`, { serviceRoleKey, getUser });
    expect(ok).toBe(true);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('accepts a user token that resolves to an admin', async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: { app_metadata: { role: 'admin' } } }, error: null });
    expect(await authorizeAdminRequest('Bearer user-jwt', { serviceRoleKey, getUser })).toBe(true);
    expect(getUser).toHaveBeenCalledWith('user-jwt');
  });

  it('rejects a valid user token without the admin role', async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: { app_metadata: {} } }, error: null });
    expect(await authorizeAdminRequest('Bearer user-jwt', { serviceRoleKey, getUser })).toBe(false);
  });

  it('rejects the publishable key and any token getUser cannot resolve', async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } });
    expect(await authorizeAdminRequest('Bearer sb_publishable_abc', { serviceRoleKey, getUser })).toBe(false);
  });

  it('rejects a missing or empty header', async () => {
    const getUser = vi.fn();
    expect(await authorizeAdminRequest(null, { serviceRoleKey, getUser })).toBe(false);
    expect(await authorizeAdminRequest('Bearer ', { serviceRoleKey, getUser })).toBe(false);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('never treats an empty service-role key as a match', async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'x' } });
    expect(await authorizeAdminRequest('Bearer ', { serviceRoleKey: '', getUser })).toBe(false);
  });

  it('rejects when getUser throws', async () => {
    const getUser = vi.fn().mockRejectedValue(new Error('network'));
    expect(await authorizeAdminRequest('Bearer user-jwt', { serviceRoleKey, getUser })).toBe(false);
  });
});
