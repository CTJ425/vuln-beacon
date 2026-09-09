import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleSettings } from '@/components/sync/ScheduleSettings';
import { Vendor } from '@/types';

const vendor = (over: Partial<Vendor> = {}): Vendor => ({
  id: 'id-redhat',
  code: 'redhat',
  name: 'Red Hat',
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  schedule_enabled: true,
  schedule_times: ['08:00', '12:30', '18:30'],
  schedule_timezone: 'Asia/Taipei',
  last_scheduled_run_at: null,
  ...over,
});

const ok = () => Promise.resolve({ success: true });

describe('ScheduleSettings', () => {
  it('renders one editable row per vendor', () => {
    render(<ScheduleSettings vendors={[vendor(), vendor({ id: 'id-vmware', code: 'vmware', name: 'VMware', schedule_enabled: false, schedule_times: [] })]} onSave={vi.fn(ok)} />);

    expect(screen.getByLabelText('Schedule times for Red Hat')).toHaveValue('08:00, 12:30, 18:30');
    expect(screen.getByLabelText('Timezone for Red Hat')).toHaveValue('Asia/Taipei');
    expect(screen.getByLabelText('Enable schedule for Red Hat')).toBeChecked();
    expect(screen.getByLabelText('Enable schedule for VMware')).not.toBeChecked();
    expect(screen.getByLabelText('Enable schedule for VMware')).toBeDisabled();
    expect(screen.getByText('Adapter not implemented')).toBeInTheDocument();
  });

  it('saves the edited schedule through the callback', async () => {
    const onSave = vi.fn(ok);
    render(<ScheduleSettings vendors={[vendor()]} onSave={onSave} />);

    const times = screen.getByLabelText('Schedule times for Red Hat');
    await userEvent.clear(times);
    await userEvent.type(times, '09:15, 21:45');
    await userEvent.click(screen.getByRole('button', { name: 'Save Red Hat' }));

    expect(onSave).toHaveBeenCalledWith('redhat', {
      enabled: true,
      times: ['09:15', '21:45'],
      timezone: 'Asia/Taipei',
    });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('blocks an invalid time before calling the callback', async () => {
    const onSave = vi.fn(ok);
    render(<ScheduleSettings vendors={[vendor()]} onSave={onSave} />);

    const times = screen.getByLabelText('Schedule times for Red Hat');
    await userEvent.clear(times);
    await userEvent.type(times, '25:00');
    await userEvent.click(screen.getByRole('button', { name: 'Save Red Hat' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByText('Invalid time format')).toBeInTheDocument();
  });

  it('shows the error returned by a failed save', async () => {
    const onSave = vi.fn(() => Promise.resolve({ success: false, error: 'Invalid timezone' }));
    render(<ScheduleSettings vendors={[vendor()]} onSave={onSave} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save Red Hat' }));

    expect(await screen.findByText('Invalid timezone')).toBeInTheDocument();
  });

  it('reports an empty vendor list the same way the feed table does', () => {
    render(<ScheduleSettings vendors={[]} onSave={vi.fn(ok)} />);
    expect(screen.getByText('No vendor records loaded.')).toBeInTheDocument();
  });

  it('renders Vault secrets setup guide banner and can toggle instructions', async () => {
    render(<ScheduleSettings vendors={[vendor()]} onSave={vi.fn(ok)} />);
    expect(screen.getByText('排程同步與 Supabase Vault 憑證指引')).toBeInTheDocument();
    
    const toggleButton = screen.getByRole('button', { name: '查看設定指令' });
    expect(toggleButton).toBeInTheDocument();
    await userEvent.click(toggleButton);

    expect(screen.getByText('收合指引')).toBeInTheDocument();
    expect(screen.getByText('複製 SQL 範本')).toBeInTheDocument();
    expect(screen.getAllByText(/scheduled_sync_url/).length).toBeGreaterThanOrEqual(1);
  });

  it('displays warning chip when hasVaultError is true', () => {
    render(<ScheduleSettings vendors={[vendor()]} onSave={vi.fn(ok)} hasVaultError={true} />);
    expect(screen.getByText('排程同步與 Supabase Vault 憑證指引')).toBeInTheDocument();
    expect(screen.getByText('Missing Vault Secrets')).toBeInTheDocument();
  });

  it('renders with initialExpanded={true} to display instructions immediately', () => {
    render(<ScheduleSettings vendors={[vendor()]} onSave={vi.fn(ok)} initialExpanded={true} />);
    expect(screen.getByText('收合指引')).toBeInTheDocument();
    expect(screen.getByText('複製 SQL 範本')).toBeInTheDocument();
    expect(screen.getAllByText(/scheduled_sync_url/).length).toBeGreaterThanOrEqual(1);
  });
});

