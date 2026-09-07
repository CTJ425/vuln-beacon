import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SystemHealthMonitor } from '@/components/admin/SystemHealthMonitor';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('SystemHealthMonitor Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({ count: 8, error: null }),
    } as any);

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any);

    vi.mocked(supabase.storage.from).mockReturnValue({
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as any);

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: null,
    } as any);

    // Mock fetch for external feeds
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as any);
  });

  it('renders overall status and service diagnostic cards', async () => {
    render(<SystemHealthMonitor />);

    expect(screen.getByText(/API 與 Supabase 運作狀態監控/i)).toBeInTheDocument();
    expect(screen.getByText(/Supabase 核心基礎架構/i)).toBeInTheDocument();
    expect(screen.getByText(/外部資安廠商資料來源/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/運作正常|Operational/i).length).toBeGreaterThan(0);
      expect(screen.getByText('Postgres Database')).toBeInTheDocument();
      expect(screen.getByText('Supabase Auth (GoTrue)')).toBeInTheDocument();
      expect(screen.getByText('Advisory Storage (S3)')).toBeInTheDocument();
      expect(screen.getByText('Edge Functions Runtime')).toBeInTheDocument();
    });
  });

  it('triggers on-demand diagnostics check when refresh button is clicked', async () => {
    render(<SystemHealthMonitor />);

    await waitFor(() => {
      expect(screen.getByText('Postgres Database')).toBeInTheDocument();
    });

    const refreshBtn = screen.getByRole('button', { name: /重新檢測運作狀態/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('vendors');
      expect(supabase.auth.getSession).toHaveBeenCalled();
    });
  });

  it('handles and displays service error when a check fails', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({ count: null, error: { message: 'DB Connection Timeout' } }),
    } as any);

    render(<SystemHealthMonitor />);

    await waitFor(() => {
      expect(screen.getByText('DB Connection Timeout')).toBeInTheDocument();
    });
  });

  it('handles and displays edge function error when edge check fails', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'Edge Function 500 error' },
    } as any);

    render(<SystemHealthMonitor />);

    await waitFor(() => {
      expect(screen.getByText('Edge Function 500 error')).toBeInTheDocument();
    });
  });
});
