/**
 * Validates whether a destination webhook URL is safe from SSRF.
 * Enforces HTTPS, blocks localhost, IPv4/IPv6 private ranges, and cloud metadata endpoints.
 */
export function isSafeDestinationUrl(inputUrl: string): boolean {
  try {
    const parsed = new URL(inputUrl);
    if (parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check localhost / local names
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.lan') ||
      hostname.endsWith('.home.arpa')
    ) {
      return false;
    }

    // Check IPv6 addresses (enclosed in brackets in WHATWG URLs)
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      const ip6 = hostname.slice(1, -1).toLowerCase();
      // Unspecified / loopback
      if (ip6 === '::' || ip6 === '::1') return false;
      // RFC 4193 Unique Local Addresses (fc00::/7 -> fc.. and fd..)
      if (ip6.startsWith('fc') || ip6.startsWith('fd')) return false;
      // RFC 4291 Link-Local Unicast (fe80::/10 -> fe8, fe9, fea, feb)
      if (
        ip6.startsWith('fe8') ||
        ip6.startsWith('fe9') ||
        ip6.startsWith('fea') ||
        ip6.startsWith('feb')
      ) {
        return false;
      }
      // IPv4-mapped IPv6 addresses (::ffff:0:0/96)
      if (ip6.startsWith('::ffff:')) return false;
      return true;
    }

    if (hostname === '::1' || hostname === '::') {
      return false;
    }

    // Check if hostname is an IPv4 address
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const o1 = Number(match[1]);
      const o2 = Number(match[2]);
      const o3 = Number(match[3]);
      const o4 = Number(match[4]);
      if (o1 > 255 || o2 > 255 || o3 > 255 || o4 > 255) {
        return false;
      }
      // 0.0.0.0/8
      if (o1 === 0) return false;
      // 127.0.0.0/8 (Loopback)
      if (o1 === 127) return false;
      // 10.0.0.0/8 (Private)
      if (o1 === 10) return false;
      // 172.16.0.0/12 (Private)
      if (o1 === 172 && o2 >= 16 && o2 <= 31) return false;
      // 192.168.0.0/16 (Private)
      if (o1 === 192 && o2 === 168) return false;
      // 169.254.0.0/16 (Link-local / Cloud metadata AWS/GCP/Azure)
      if (o1 === 169 && o2 === 254) return false;
      // 100.64.0.0/10 (Carrier-Grade NAT / Shared Address Space)
      if (o1 === 100 && o2 >= 64 && o2 <= 127) return false;
      // 224.0.0.0/4 (Multicast / Reserved / Broadcast)
      if (o1 >= 224) return false;
    }

    return true;
  } catch {
    return false;
  }
}
