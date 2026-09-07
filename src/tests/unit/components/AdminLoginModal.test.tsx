import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminLoginModal } from '@/components/admin/AdminLoginModal';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}));

describe('AdminLoginModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password inputs when open', () => {
    render(<AdminLoginModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByText(/後台系統身分驗證/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登入後台/i })).toBeInTheDocument();
  });

  it('submits credentials to supabase.auth.signInWithPassword', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: 'admin-1', email: 'admin@vulnbeacon.com' } as any, session: {} as any },
      error: null,
    });

    const handleSuccess = vi.fn();
    render(<AdminLoginModal open={true} onClose={vi.fn()} onSuccess={handleSuccess} />);

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'admin@vulnbeacon.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'secret123' } });

    fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'admin@vulnbeacon.com',
        password: 'secret123',
      });
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('displays error message when login fails', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' } as any,
    });

    render(<AdminLoginModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'wrong@user.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'badpass' } });

    fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument();
  });

  it('displays warning when session is null despite successful auth (e.g. email unconfirmed)', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: 'u-1', email: 'unconfirmed@user.com' }, session: null } as any,
      error: null,
    });

    render(<AdminLoginModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'unconfirmed@user.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'pass123' } });

    fireEvent.click(screen.getByRole('button', { name: /登入後台/i }));

    expect(await screen.findByText(/登入未完成，帳號可能需要先完成信箱驗證/i)).toBeInTheDocument();
  });
});
