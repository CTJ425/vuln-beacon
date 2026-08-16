import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WebhookConfigPanel } from '@/components/settings/WebhookConfigPanel';
import { WebhookConfig } from '@/types';

/**
 * BUG-014 / BUG-013 regression cover: a webhook destination URL embeds a secret
 * token, so it must never reach the DOM, whatever shape the URL has. Deletion
 * must also require a confirmation step.
 */

const hook = (over: Partial<WebhookConfig> = {}): WebhookConfig =>
  ({
    id: 'hook-1',
    name: 'Security Ops',
    platform: 'discord',
    webhook_url: 'https://discord.com/api/webhooks/123/SUPERSECRETTOKEN',
    min_severity: 'HIGH',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...over,
  }) as WebhookConfig;

const renderPanel = (webhooks: WebhookConfig[], onDeleteWebhook = vi.fn()) => {
  const utils = render(
    <WebhookConfigPanel
      webhooks={webhooks}
      onAddWebhook={vi.fn()}
      onDeleteWebhook={onDeleteWebhook}
      onTestWebhook={vi.fn().mockResolvedValue(true)}
    />
  );
  return { ...utils, onDeleteWebhook };
};

describe('BUG-014: the webhook secret never reaches the DOM', () => {
  it('masks a nested token (Discord shape)', () => {
    const { container } = renderPanel([hook()]);

    expect(container.innerHTML).not.toContain('SUPERSECRETTOKEN');
  });

  it('masks a token that is itself the first path segment (ntfy shape)', () => {
    const { container } = renderPanel([
      hook({ webhook_url: 'https://ntfy.example.com/SUPERSECRETTOPIC' }),
    ]);

    expect(container.innerHTML).not.toContain('SUPERSECRETTOPIC');
  });

  it('masks the query string and fragment too', () => {
    const { container } = renderPanel([
      hook({ webhook_url: 'https://relay.example.com/path?token=SUPERSECRETQUERY#SUPERSECRETHASH' }),
    ]);

    expect(container.innerHTML).not.toContain('SUPERSECRETQUERY');
    expect(container.innerHTML).not.toContain('SUPERSECRETHASH');
  });

  it('still shows the origin so an operator can recognise the destination', () => {
    const { container } = renderPanel([hook()]);

    expect(container.innerHTML).toContain('https://discord.com');
  });
});

describe('BUG-013: deleting a webhook requires confirmation', () => {
  it('does not delete on the first click, and does on the confirming second click', () => {
    const onDeleteWebhook = vi.fn();
    renderPanel([hook()], onDeleteWebhook);

    const deleteButton = screen.getByTestId('delete-webhook-hook-1');

    fireEvent.click(deleteButton);
    expect(onDeleteWebhook).not.toHaveBeenCalled();
    expect(deleteButton.textContent).toMatch(/confirm/i);

    fireEvent.click(deleteButton);
    expect(onDeleteWebhook).toHaveBeenCalledWith('hook-1');
  });
});
