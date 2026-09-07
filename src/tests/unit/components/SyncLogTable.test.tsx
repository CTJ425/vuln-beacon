import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncLogTable } from '@/components/sync/SyncLogTable';
import { VendorSyncLog } from '@/types';

describe('SyncLogTable Component', () => {
  const sampleLogs: VendorSyncLog[] = [
    {
      id: 'log-1',
      vendor_code: 'redhat',
      status: 'SUCCESS',
      items_fetched: 15,
      new_items_count: 2,
      duration_ms: 850,
      started_at: '2026-09-07T12:00:00.000Z',
      finished_at: '2026-09-07T12:00:00.850Z',
      details: {
        advisories_count: 15,
        new_cves_count: 2,
      },
    },
    {
      id: 'log-2',
      vendor_code: 'vmware',
      status: 'FAILED',
      items_fetched: 0,
      new_items_count: 0,
      duration_ms: 120,
      started_at: '2026-09-07T13:00:00.000Z',
      finished_at: '2026-09-07T13:00:00.120Z',
      error_message: 'Service Unavailable 503',
      details: {
        status_code: 503,
      },
    },
  ];

  it('renders log table with log details observation column', () => {
    render(<SyncLogTable logs={sampleLogs} />);

    expect(screen.getByText('Vendor')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Log Details')).toBeInTheDocument();

    expect(screen.getByText('SUCCESS')).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText('Service Unavailable 503')).toBeInTheDocument();
  });

  it('opens log detail observation modal when inspect button is clicked', async () => {
    render(<SyncLogTable logs={sampleLogs} />);

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect/i });
    expect(inspectButtons.length).toBe(2);

    fireEvent.click(inspectButtons[0]);

    expect(await screen.findByText(/Log Observability & Diagnostics/i)).toBeInTheDocument();
    expect(screen.getByText('Log ID: log-1 • 2026-09-07 20:00:00')).toBeInTheDocument();
  });
});
