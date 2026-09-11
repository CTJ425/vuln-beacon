import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { IngestionEngine } from '@/engine/ingestion';
import { ALL_ADAPTERS } from '@/adapters';
import { FeedSourceTable } from '@/components/sync/FeedSourceTable';
import { AdvisoryDetailDrawer } from '@/components/explorer/AdvisoryDetailDrawer';
import { CveDetailDrawer } from '@/components/explorer/CveDetailDrawer';
import { Vendor, VendorSyncLog } from '@/types';
import ubuntuFixture from '../fixtures/ubuntu/ubuntu-notice-sample.json';
import debianFixture from '../fixtures/debian/debian-dsa-sample.json';
import suseFixture from '../fixtures/suse/suse-csaf-sample.json';

const theme = createTheme();

describe('Ubuntu, Debian, and SUSE Multi-Vendor Ingestion & UI Integration (E2E)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('verifies all 5 enterprise adapters are registered in ALL_ADAPTERS', () => {
    const codes = ALL_ADAPTERS.map((a) => a.vendorCode);
    expect(codes).toEqual(['redhat', 'nutanix', 'ubuntu', 'debian', 'suse']);
  });

  it('executes IngestionEngine end-to-end for Ubuntu, Debian, and SUSE', async () => {
    const engine = new IngestionEngine();

    // 1. Ingest Ubuntu
    const ubuntuRes = await engine.ingestVendor('ubuntu', [ubuntuFixture]);
    expect(ubuntuRes.status).toBe('SUCCESS');
    expect(ubuntuRes.advisoriesCount).toBe(1);
    expect(ubuntuRes.cvesCount).toBe(1);

    // 2. Ingest Debian
    const debianRes = await engine.ingestVendor('debian', debianFixture.dsaListSample);
    expect(debianRes.status).toBe('SUCCESS');
    expect(debianRes.advisoriesCount).toBe(2);

    // 3. Ingest SUSE
    const suseRes = await engine.ingestVendor('suse', [suseFixture]);
    expect(suseRes.status).toBe('SUCCESS');
    expect(suseRes.advisoriesCount).toBe(1);
    expect(suseRes.cvesCount).toBe(1);

    const allAdvisories = engine.getAdvisories();
    expect(allAdvisories.length).toBe(4); // 1 ubuntu + 2 debian + 1 suse

    const allCves = engine.getCves();
    expect(allCves.some((c) => c.cve_id === 'CVE-2026-42052')).toBe(true); // ubuntu
    expect(allCves.some((c) => c.cve_id === 'CVE-2026-26961')).toBe(true); // debian
    expect(allCves.some((c) => c.cve_id === 'CVE-2026-32147')).toBe(true); // suse
  });

  it('renders FeedSourceTable showing Ubuntu, Debian, and SUSE as Connected with endpoints', () => {
    const mockVendors: Vendor[] = [
      { id: 'v1', code: 'ubuntu', name: 'Ubuntu', is_active: true, created_at: '2026-01-01' },
      { id: 'v2', code: 'debian', name: 'Debian', is_active: true, created_at: '2026-01-01' },
      { id: 'v3', code: 'suse', name: 'SUSE', is_active: true, created_at: '2026-01-01' },
    ];
    const mockLogs: VendorSyncLog[] = [
      {
        id: 'l1',
        vendor_code: 'ubuntu',
        status: 'SUCCESS',
        items_fetched: 20,
        new_items_count: 5,
        started_at: '2026-09-11T08:00:00Z',
      },
    ];

    render(
      <ThemeProvider theme={theme}>
        <FeedSourceTable vendors={mockVendors} logs={mockLogs} />
      </ThemeProvider>
    );

    // All three should show Connected
    const connectedChips = screen.getAllByText('Connected');
    expect(connectedChips.length).toBe(3);

    // Endpoints should be visible
    expect(screen.getByText('https://ubuntu.com/security/notices.json')).toBeInTheDocument();
    expect(
      screen.getByText('https://security-tracker.debian.org/tracker/data/json')
    ).toBeInTheDocument();
    expect(
      screen.getByText('https://ftp.suse.com/pub/projects/security/csaf/changes.csv')
    ).toBeInTheDocument();
  });

  it('renders AdvisoryDetailDrawer with vendor-specific remediation commands for Ubuntu, Debian, and SUSE', () => {
    // 1. Ubuntu
    const { unmount: unmountUbuntu } = render(
      <ThemeProvider theme={theme}>
        <AdvisoryDetailDrawer
          item={{
            id: 'adv-ub-1',
            advisory_id: 'USN-8747-1',
            title: 'Beets vulnerability',
            severity: 'MEDIUM',
            published_at: '2026-09-10',
            vendor_code: 'ubuntu',
            vendor_name: 'Ubuntu',
            url: 'https://ubuntu.com/security/notices/USN-8747-1',
            affected_products: ['Ubuntu jammy'],
            cves: [
              {
                cve_id: 'CVE-2026-42052',
                description: 'Beets vulnerability',
                severity: 'MEDIUM',
                is_known_exploited: false,
              },
            ],
            product_impacts: [
              { product_name: 'Ubuntu jammy', component: 'beets', state: 'Fixed' },
            ],
            fixed_versions: ['1.6.0-1ubuntu0.1~esm1'],
          }}
          open={true}
          onClose={vi.fn()}
        />
      </ThemeProvider>
    );
    expect(screen.getByText(/sudo apt-get --only-upgrade install -y beets/)).toBeInTheDocument();
    unmountUbuntu();

    // 2. Debian
    const { unmount: unmountDebian } = render(
      <ThemeProvider theme={theme}>
        <AdvisoryDetailDrawer
          item={{
            id: 'adv-deb-1',
            advisory_id: 'DSA-6492-1',
            title: 'ruby-rack security update',
            severity: 'HIGH',
            published_at: '2026-09-10',
            vendor_code: 'debian',
            vendor_name: 'Debian',
            url: 'https://security-tracker.debian.org/tracker/DSA-6492-1',
            affected_products: ['Debian trixie'],
            cves: [
              {
                cve_id: 'CVE-2026-26961',
                description: 'ruby-rack security update',
                severity: 'HIGH',
                is_known_exploited: false,
              },
            ],
            product_impacts: [
              { product_name: 'Debian trixie', component: 'ruby-rack', state: 'Fixed' },
            ],
            fixed_versions: ['3.1.20-0+deb13u2'],
          }}
          open={true}
          onClose={vi.fn()}
        />
      </ThemeProvider>
    );
    expect(screen.getByText(/sudo apt-get --only-upgrade install -y ruby-rack/)).toBeInTheDocument();
    unmountDebian();

    // 3. SUSE
    render(
      <ThemeProvider theme={theme}>
        <AdvisoryDetailDrawer
          item={{
            id: 'adv-suse-1',
            advisory_id: 'SUSE-SU-2026:3951-1',
            title: 'Security update for erlang',
            severity: 'MEDIUM',
            published_at: '2026-09-03',
            vendor_code: 'suse',
            vendor_name: 'SUSE',
            url: 'https://www.suse.com/security/cve/CVE-2026-32147',
            affected_products: ['SUSE Linux Enterprise Server 15 SP7'],
            cves: [
              {
                cve_id: 'CVE-2026-32147',
                description: 'Security update for erlang',
                severity: 'MEDIUM',
                is_known_exploited: false,
              },
            ],
            product_impacts: [
              { product_name: 'SUSE Linux Enterprise Server 15 SP7', component: 'erlang', state: 'Fixed' },
            ],
            fixed_versions: ['erlang-23.3.4.19-150300.3.42.1.x86_64'],
          }}
          open={true}
          onClose={vi.fn()}
        />
      </ThemeProvider>
    );
    expect(screen.getByText(/sudo zypper update -y erlang/)).toBeInTheDocument();
  });

  it('renders CveDetailDrawer with vendor official advisory links and commands', () => {
    render(
      <ThemeProvider theme={theme}>
        <CveDetailDrawer
          item={{
            id: 'cve-ub-1',
            cve_id: 'CVE-2026-42052',
            severity: 'MEDIUM',
            vendor_code: 'ubuntu',
            description: 'Beets DOM XSS vulnerability',
            advisory_id: 'USN-8747-1',
            advisory_title: 'USN-8747-1: beets vulnerability',
            affected_products: ['Ubuntu jammy'],
            is_known_exploited: false,
            created_at: '2026-09-10T00:00:00Z',
            all_advisories: ['USN-8747-1'],
            product_impacts: [
              { product_name: 'Ubuntu jammy', component: 'beets', state: 'Fixed', errata: 'USN-8747-1' },
            ],
            fixed_versions: ['1.6.0-1ubuntu0.1~esm1'],
          }}
          open={true}
          onClose={vi.fn()}
        />
      </ThemeProvider>
    );

    const link = screen.getByRole('link', { name: /檢視官方公告頁面/i });
    expect(link).toHaveAttribute('href', 'https://ubuntu.com/security/cves/CVE-2026-42052');
    expect(screen.getByText(/sudo apt-get --only-upgrade install -y beets/)).toBeInTheDocument();
  });

  it('renders CveDetailDrawer with specific SUSE announcement URL for advisory chips', () => {
    render(
      <ThemeProvider theme={theme}>
        <CveDetailDrawer
          item={{
            id: 'cve-suse-1',
            cve_id: 'CVE-2026-32147',
            severity: 'MEDIUM',
            vendor_code: 'suse',
            description: 'Erlang path traversal',
            advisory_id: 'SUSE-SU-2026:3951-1',
            advisory_title: 'SUSE-SU-2026:3951-1: Security update for erlang',
            all_advisories: ['SUSE-SU-2026:3951-1', 'SUSE-SU-2026:3952-1'],
            affected_products: ['SUSE Linux Enterprise Server 15 SP7'],
            is_known_exploited: false,
            created_at: '2026-09-03T00:00:00Z',
            product_impacts: [],
            fixed_versions: ['erlang-23.3.4.19'],
          }}
          open={true}
          onClose={vi.fn()}
        />
      </ThemeProvider>
    );

    const chipLink = screen.getByText('SUSE-SU-2026:3952-1').closest('a');
    expect(chipLink).toHaveAttribute(
      'href',
      'https://www.suse.com/support/update/announcement/2026/suse-su-20263952-1/'
    );
  });
});
