import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { FeedSourceTable } from '@/components/sync/FeedSourceTable';
import { SyncMonitorPage } from '@/pages/SyncMonitorPage';
import { RedHatCsafAdapter } from '@/adapters/redhat-csaf';
import { Vendor, VendorSyncLog } from '@/types';

/**
 * TASK-13. The point of this panel is that the user can see which vendor API the sync
 * actually talks to, and which vendors are not wired up at all.
 */
const vendor = (code: string, name: string): Vendor => ({
  id: `id-${code}`,
  code,
  name,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
});

const VENDORS = [vendor('redhat', 'Red Hat'), vendor('vmware', 'VMware / Broadcom')];

const log = (code: string, status: VendorSyncLog['status'], error: string | null): VendorSyncLog => ({
  id: `log-${code}-${status}`,
  vendor_code: code,
  status,
  items_fetched: 1,
  new_items_count: 1,
  error_message: error,
  duration_ms: 10,
  started_at: '2026-08-28T02:40:36.566Z',
  finished_at: '2026-08-28T02:40:47.242Z',
});

const rowFor = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

describe('FeedSourceTable shows the real feed sources', () => {
  it('marks Red Hat as connected and lists every endpoint the adapter uses', () => {
    render(<FeedSourceTable vendors={VENDORS} logs={[]} />);
    const row = rowFor('Red Hat');

    expect(within(row).getByText('Connected')).toBeTruthy();
    for (const ep of new RedHatCsafAdapter().endpoints) {
      expect(within(row).getByText(ep.url)).toBeTruthy();
    }
  });

  it('marks a vendor with no adapter as not implemented and shows no endpoint', () => {
    render(<FeedSourceTable vendors={VENDORS} logs={[]} />);
    const row = rowFor('VMware / Broadcom');

    expect(within(row).getByText('Not implemented')).toBeTruthy();
    expect(within(row).getByText('No adapter implemented')).toBeTruthy();
    expect(within(row).queryByText(/access\.redhat\.com/)).toBeNull();
  });

  it('shows the newest matching log status and its error text', () => {
    render(
      <FeedSourceTable
        vendors={VENDORS}
        logs={[log('redhat', 'FAILED', 'WorkerRequestCancelled: cancelled by supervisor')]}
      />
    );
    const row = rowFor('Red Hat');

    expect(within(row).getByText('FAILED')).toBeTruthy();
    expect(within(row).getByText(/WorkerRequestCancelled/)).toBeTruthy();
  });

  it('says so plainly when no vendor records are loaded', () => {
    render(<FeedSourceTable vendors={[]} logs={[]} />);

    expect(screen.getByText('No vendor records loaded.')).toBeTruthy();
  });

  it('says Never for a vendor that has never synced', () => {
    render(<FeedSourceTable vendors={VENDORS} logs={[log('redhat', 'SUCCESS', null)]} />);
    const row = rowFor('VMware / Broadcom');

    expect(within(row).getByText('Never')).toBeTruthy();
  });
});

describe('SyncMonitorPage mounts the feed source panel', () => {
  it('renders both sections and drops the false 8-vendor claim', () => {
    const { container } = render(
      <SyncMonitorPage vendors={VENDORS} logs={[]} onManualSync={() => {}} isSyncing={false} />
    );

    expect(screen.getByText('Feed Sources')).toBeTruthy();
    expect(screen.getByText('Execution History')).toBeTruthy();
    expect(container.textContent).not.toContain('all 8 vendors');
  });
});
