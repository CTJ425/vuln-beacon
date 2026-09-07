import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminLogQuery } from '@/components/admin/AdminLogQuery';
import { VendorSyncLog } from '@/types';

describe('AdminLogQuery Component', () => {
  const sampleLogs: VendorSyncLog[] = [
    {
      id: 'log-1',
      vendor_code: 'redhat',
      status: 'SUCCESS',
      items_fetched: 10,
      new_items_count: 2,
      duration_ms: 500,
      started_at: '2026-09-07T10:00:00.000Z',
      details: { advisories_count: 10 },
    },
    {
      id: 'log-2',
      vendor_code: 'vmware',
      status: 'FAILED',
      items_fetched: 0,
      new_items_count: 0,
      duration_ms: 250,
      started_at: '2026-09-07T11:00:00.000Z',
      error_message: 'Certificate expired',
      details: { error_stack: 'CertError: expired' },
    },
    {
      id: 'log-3',
      vendor_code: 'nutanix',
      status: 'SUCCESS',
      items_fetched: 5,
      new_items_count: 0,
      duration_ms: 180,
      started_at: '2026-09-07T12:00:00.000Z',
      details: { advisories_count: 5 },
    },
  ];

  it('renders log list and filter controls', () => {
    render(<AdminLogQuery logs={sampleLogs} onRefreshLogs={vi.fn()} />);

    expect(screen.getByText(/Log 資料查詢與排錯/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/狀態篩選/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/廠商篩選/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/搜尋錯誤訊息/i)).toBeInTheDocument();

    expect(screen.getByText('Certificate expired')).toBeInTheDocument();
    expect(screen.getByText(/顯示 3 筆日誌/i)).toBeInTheDocument();
  });

  it('filters logs by status', () => {
    render(<AdminLogQuery logs={sampleLogs} onRefreshLogs={vi.fn()} />);

    // Filter by FAILED via MUI select dropdown
    const statusSelect = screen.getByLabelText(/狀態篩選/i);
    fireEvent.mouseDown(statusSelect);

    const failedOption = screen.getByRole('option', { name: /失敗 \(FAILED\)/i });
    fireEvent.click(failedOption);

    expect(screen.getByText('Certificate expired')).toBeInTheDocument();
    expect(screen.queryByText('nutanix')).not.toBeInTheDocument();
    expect(screen.getByText(/顯示 1 筆日誌/i)).toBeInTheDocument();
  });

  it('filters logs by search keyword', () => {
    render(<AdminLogQuery logs={sampleLogs} onRefreshLogs={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/搜尋錯誤訊息/i);
    fireEvent.change(searchInput, { target: { value: 'expired' } });

    expect(screen.getByText('Certificate expired')).toBeInTheDocument();
    expect(screen.queryByText('nutanix')).not.toBeInTheDocument();
  });

  it('opens observation detail modal when inspect is clicked', async () => {
    render(<AdminLogQuery logs={sampleLogs} onRefreshLogs={vi.fn()} />);

    const inspectBtns = screen.getAllByRole('button', { name: /Inspect/i });
    fireEvent.click(inspectBtns[1]); // Click FAILED log inspect

    expect(await screen.findByText(/Log Observability & Diagnostics/i)).toBeInTheDocument();
    expect(screen.getAllByText('Certificate expired').length).toBeGreaterThan(0);
  });

  it('renders table pagination controls with correct total count', () => {
    render(<AdminLogQuery logs={sampleLogs} onRefreshLogs={vi.fn()} />);

    expect(screen.getByText(/每頁筆數/i)).toBeInTheDocument();
    expect(screen.getByText(/3 of 3/i)).toBeInTheDocument();
  });
});
