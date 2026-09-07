import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogDetailModal } from '@/components/sync/LogDetailModal';
import { VendorSyncLog } from '@/types';

describe('LogDetailModal Component', () => {
  const sampleLog: VendorSyncLog = {
    id: 'log-123',
    vendor_code: 'redhat',
    status: 'SUCCESS',
    items_fetched: 42,
    new_items_count: 5,
    duration_ms: 1250,
    started_at: '2026-09-07T12:00:00.000Z',
    finished_at: '2026-09-07T12:00:01.250Z',
    details: {
      advisories_count: 42,
      cves_count: 88,
      new_cves_count: 5,
      duration_ms: 1250,
      endpoints: ['https://access.redhat.com/security/data/csaf/v2/advisories/'],
    },
  };

  const failedLog: VendorSyncLog = {
    id: 'log-999',
    vendor_code: 'vmware',
    status: 'FAILED',
    items_fetched: 0,
    new_items_count: 0,
    duration_ms: 300,
    started_at: '2026-09-07T13:00:00.000Z',
    finished_at: '2026-09-07T13:00:00.300Z',
    error_message: 'Connection timeout to feed endpoint',
    details: {
      error_name: 'TimeoutError',
      error_stack: 'TimeoutError: Connection timed out\n  at fetchWithTimeout (adapter.ts:42)',
      duration_ms: 300,
    },
  };

  it('renders log details when open is true', () => {
    render(<LogDetailModal open={true} log={sampleLog} onClose={vi.fn()} />);

    expect(screen.getByText(/Log Observability & Diagnostics/i)).toBeInTheDocument();
    expect(screen.getByText('SUCCESS')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('1250ms')).toBeInTheDocument();
  });

  it('displays error message and stack trace when status is FAILED', () => {
    render(<LogDetailModal open={true} log={failedLog} onClose={vi.fn()} />);

    expect(screen.getByText('Connection timeout to feed endpoint')).toBeInTheDocument();
    expect(screen.getAllByText(/TimeoutError: Connection timed out/i).length).toBeGreaterThan(0);
  });

  it('allows copying full log payload to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<LogDetailModal open={true} log={sampleLog} onClose={vi.fn()} />);

    const copyBtn = screen.getByRole('button', { name: /Copy Log JSON/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('log-123'));
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<LogDetailModal open={true} log={sampleLog} onClose={handleClose} />);

    const closeBtn = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
