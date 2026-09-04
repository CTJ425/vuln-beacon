import { describe, it, expect } from 'vitest';
import { isSafeDestinationUrl } from '@/utils/urlValidator';

describe('isSafeDestinationUrl (SSRF protection)', () => {
  it('allows valid public HTTPS URLs', () => {
    expect(isSafeDestinationUrl('https://discord.com/api/webhooks/123/xyz')).toBe(true);
    expect(isSafeDestinationUrl('https://hooks.slack.com/services/T00/B00/X00')).toBe(true);
    expect(isSafeDestinationUrl('https://api.telegram.org/bot123/sendMessage')).toBe(true);
  });

  it('rejects non-HTTPS protocols', () => {
    expect(isSafeDestinationUrl('http://example.com/webhook')).toBe(false);
    expect(isSafeDestinationUrl('ftp://example.com/webhook')).toBe(false);
    expect(isSafeDestinationUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects localhost and local domain names', () => {
    expect(isSafeDestinationUrl('https://localhost/webhook')).toBe(false);
    expect(isSafeDestinationUrl('https://test.localhost/webhook')).toBe(false);
    expect(isSafeDestinationUrl('https://my-service.local/webhook')).toBe(false);
    expect(isSafeDestinationUrl('https://internal-host.internal/webhook')).toBe(false);
  });

  it('rejects IPv6 loopback', () => {
    expect(isSafeDestinationUrl('https://[::1]/webhook')).toBe(false);
  });

  it('rejects private IPv4 addresses and link-local cloud metadata', () => {
    // Loopback 127.0.0.0/8
    expect(isSafeDestinationUrl('https://127.0.0.1/webhook')).toBe(false);
    expect(isSafeDestinationUrl('https://127.1.2.3:8443/webhook')).toBe(false);

    // Private 10.0.0.0/8
    expect(isSafeDestinationUrl('https://10.0.0.1/webhook')).toBe(false);

    // Private 172.16.0.0/12
    expect(isSafeDestinationUrl('https://172.16.0.1/webhook')).toBe(false);
    expect(isSafeDestinationUrl('https://172.31.255.255/webhook')).toBe(false);

    // Private 192.168.0.0/16
    expect(isSafeDestinationUrl('https://192.168.1.1/webhook')).toBe(false);

    // Cloud Metadata 169.254.169.254
    expect(isSafeDestinationUrl('https://169.254.169.254/latest/meta-data/')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isSafeDestinationUrl('')).toBe(false);
    expect(isSafeDestinationUrl('not-a-url')).toBe(false);
  });
});
