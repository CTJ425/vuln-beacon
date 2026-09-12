import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ScheduleSettings,
  TIME_OPTIONS,
  TIMEZONE_OPTIONS,
} from '@/components/sync/ScheduleSettings';
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

const timesSelect = () => screen.getByRole('combobox', { name: /Schedule times for Red Hat/ });
const timezoneSelect = () => screen.getByRole('combobox', { name: /Timezone for Red Hat/ });
const saveButton = () => screen.getByRole('button', { name: 'Save Red Hat' });

// Closes the still-open multi-select menu so the next query is unambiguous.
const closeMenu = async () => {
  await userEvent.keyboard('{Escape}');
};

describe('TIME_OPTIONS', () => {
  it('covers a full day on a 30-minute grid, matching the 5-minute cron tick', () => {
    expect(TIME_OPTIONS).toHaveLength(48);
    expect(TIME_OPTIONS[0]).toBe('00:00');
    expect(TIME_OPTIONS[1]).toBe('00:30');
    expect(TIME_OPTIONS[47]).toBe('23:30');
    expect(TIME_OPTIONS.every((t) => /^([01][0-9]|2[0-3]):(00|30)$/.test(t))).toBe(true);
  });
});

describe('TIMEZONE_OPTIONS', () => {
  it('offers a fixed IANA whitelist including the project default', () => {
    expect(TIMEZONE_OPTIONS).toContain('Asia/Taipei');
    expect(TIMEZONE_OPTIONS).toContain('UTC');
    expect(new Set(TIMEZONE_OPTIONS).size).toBe(TIMEZONE_OPTIONS.length);
  });
});

describe('ScheduleSettings', () => {
  it('renders one editable row per vendor', () => {
    render(
      <ScheduleSettings
        vendors={[
          vendor(),
          vendor({ id: 'id-vmware', code: 'vmware', name: 'VMware', schedule_enabled: false, schedule_times: [] }),
        ]}
        onSave={vi.fn(ok)}
      />
    );

    expect(timesSelect()).toHaveTextContent('08:00');
    expect(timesSelect()).toHaveTextContent('12:30');
    expect(timesSelect()).toHaveTextContent('18:30');
    expect(timezoneSelect()).toHaveTextContent('Asia/Taipei');
    expect(screen.getByLabelText('Enable schedule for Red Hat')).toBeChecked();
    expect(screen.getByLabelText('Enable schedule for VMware')).not.toBeChecked();
    expect(screen.getByLabelText('Enable schedule for VMware')).toBeDisabled();
    expect(screen.getByText('Adapter not implemented')).toBeInTheDocument();
  });

  it('lists every half-hour slot once when the stored times are all on the grid', async () => {
    render(<ScheduleSettings vendors={[vendor()]} onSave={vi.fn(ok)} />);

    await userEvent.click(timesSelect());
    expect(screen.getAllByRole('option')).toHaveLength(48);
    await closeMenu();
  });

  it('adds a selected time and saves the result sorted', async () => {
    const onSave = vi.fn(ok);
    render(<ScheduleSettings vendors={[vendor()]} onSave={onSave} />);

    await userEvent.click(timesSelect());
    await userEvent.click(screen.getByRole('option', { name: '09:00' }));
    await closeMenu();
    await userEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith('redhat', {
      enabled: true,
      times: ['08:00', '09:00', '12:30', '18:30'],
      timezone: 'Asia/Taipei',
    });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('removes a time when its option is deselected', async () => {
    const onSave = vi.fn(ok);
    render(<ScheduleSettings vendors={[vendor()]} onSave={onSave} />);

    await userEvent.click(timesSelect());
    await userEvent.click(screen.getByRole('option', { name: '12:30' }));
    await closeMenu();
    await userEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith('redhat', {
      enabled: true,
      times: ['08:00', '18:30'],
      timezone: 'Asia/Taipei',
    });
  });

  it('blocks an enabled schedule that has no time selected', async () => {
    const onSave = vi.fn(ok);
    render(<ScheduleSettings vendors={[vendor({ schedule_times: [] })]} onSave={onSave} />);

    await userEvent.click(saveButton());

    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByText('Select at least one time')).toBeInTheDocument();
  });

  it('allows a disabled schedule to be saved with no time selected', async () => {
    const onSave = vi.fn(ok);
    render(
      <ScheduleSettings
        vendors={[vendor({ schedule_enabled: false, schedule_times: [] })]}
        onSave={onSave}
      />
    );

    await userEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith('redhat', {
      enabled: false,
      times: [],
      timezone: 'Asia/Taipei',
    });
  });

  it('keeps a stored off-grid time selectable instead of dropping it', async () => {
    const onSave = vi.fn(ok);
    render(<ScheduleSettings vendors={[vendor({ schedule_times: ['08:07', '18:30'] })]} onSave={onSave} />);

    expect(timesSelect()).toHaveTextContent('08:07');

    await userEvent.click(timesSelect());
    expect(screen.getAllByRole('option')).toHaveLength(49);
    expect(screen.getByRole('option', { name: '08:07' })).toBeInTheDocument();
    await closeMenu();

    await userEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith('redhat', {
      enabled: true,
      times: ['08:07', '18:30'],
      timezone: 'Asia/Taipei',
    });
  });

  it('saves a timezone picked from the whitelist', async () => {
    const onSave = vi.fn(ok);
    render(<ScheduleSettings vendors={[vendor()]} onSave={onSave} />);

    await userEvent.click(timezoneSelect());
    await userEvent.click(screen.getByRole('option', { name: 'UTC' }));
    await userEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith('redhat', {
      enabled: true,
      times: ['08:00', '12:30', '18:30'],
      timezone: 'UTC',
    });
  });

  it('keeps a stored timezone that is not in the whitelist', async () => {
    render(<ScheduleSettings vendors={[vendor({ schedule_timezone: 'Pacific/Chatham' })]} onSave={vi.fn(ok)} />);

    expect(timezoneSelect()).toHaveTextContent('Pacific/Chatham');

    await userEvent.click(timezoneSelect());
    expect(screen.getByRole('option', { name: 'Pacific/Chatham' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(TIMEZONE_OPTIONS.length + 1);
  });

  it('shows the error returned by a failed save', async () => {
    const onSave = vi.fn(() => Promise.resolve({ success: false, error: 'Invalid timezone' }));
    render(<ScheduleSettings vendors={[vendor()]} onSave={onSave} />);

    await userEvent.click(saveButton());

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
