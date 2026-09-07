import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminPage } from '@/pages/AdminPage';

describe('AdminPage Component', () => {
  const mockWebhooks: any[] = [];
  const mockLogs: any[] = [];

  it('renders admin console header, tabs, and sign out button', () => {
    const handleSignOut = vi.fn();
    render(
      <AdminPage
        userEmail="admin@vulnbeacon.com"
        webhooks={mockWebhooks}
        onAddWebhook={vi.fn()}
        onDeleteWebhook={vi.fn()}
        onTestWebhook={vi.fn().mockResolvedValue(true)}
        logs={mockLogs}
        onRefreshLogs={vi.fn()}
        onSignOut={handleSignOut}
      />
    );

    expect(screen.getByText(/後台管理系統/i)).toBeInTheDocument();
    expect(screen.getByText(/admin@vulnbeacon.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登出/i })).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: /Webhook 設定/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Log 資料查詢/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /API 與 Supabase 運作狀態/i })).toBeInTheDocument();
  });

  it('switches tabs when tab buttons are clicked', () => {
    render(
      <AdminPage
        userEmail="admin@vulnbeacon.com"
        webhooks={mockWebhooks}
        onAddWebhook={vi.fn()}
        onDeleteWebhook={vi.fn()}
        onTestWebhook={vi.fn().mockResolvedValue(true)}
        logs={mockLogs}
        onRefreshLogs={vi.fn()}
        onSignOut={vi.fn()}
      />
    );

    // Initial tab: Webhooks
    expect(screen.getByText(/Add Webhook Integration/i)).toBeInTheDocument();

    // Click Log Query tab
    fireEvent.click(screen.getByRole('tab', { name: /Log 資料查詢/i }));
    expect(screen.getByText(/Log 資料查詢與排錯/i)).toBeInTheDocument();

    // Click System Status tab
    fireEvent.click(screen.getByRole('tab', { name: /API 與 Supabase 運作狀態/i }));
    expect(screen.getByText(/API 與 Supabase 運作狀態監控/i)).toBeInTheDocument();
  });

  it('calls onSignOut when sign out button is clicked', () => {
    const handleSignOut = vi.fn();
    render(
      <AdminPage
        userEmail="admin@vulnbeacon.com"
        webhooks={mockWebhooks}
        onAddWebhook={vi.fn()}
        onDeleteWebhook={vi.fn()}
        onTestWebhook={vi.fn().mockResolvedValue(true)}
        logs={mockLogs}
        onRefreshLogs={vi.fn()}
        onSignOut={handleSignOut}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /登出/i }));
    expect(handleSignOut).toHaveBeenCalledTimes(1);
  });
});
