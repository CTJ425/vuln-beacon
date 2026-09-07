import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExplorerPage } from '@/pages/ExplorerPage';
import { VendorPage } from '@/pages/VendorPage';
import { SyncService } from '@/services/syncService';

/**
 * R2. `handleFetchDirectly` performs a real vendor fetch and persists advisories,
 * CVEs and mappings through the `sync-cve` edge function. That is a manual vendor
 * synchronization, so it must never be reachable from the public Explorer page by
 * an unauthenticated visitor.
 */
describe('ExplorerPage direct-fetch is gated to authenticated admins (R2)', () => {
  const spyOnDirectFetch = () =>
    vi.spyOn(SyncService.prototype, 'fetchAndIngestQuery').mockResolvedValue(true);

  let fetchSpy: ReturnType<typeof spyOnDirectFetch>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchSpy = spyOnDirectFetch();
  });

  const renderExplorer = (isAuthenticated: boolean) =>
    render(
      <ExplorerPage
        cves={[]}
        advisories={[]}
        onSelectCve={vi.fn()}
        onSelectAdvisory={vi.fn()}
        isAuthenticated={isAuthenticated}
      />
    );

  const searchForSomethingMissing = () => {
    const searchBox = screen.getByRole('textbox');
    fireEvent.change(searchBox, { target: { value: 'CVE-2026-9999' } });
  };

  it('does not offer the direct-fetch control to an unauthenticated visitor', () => {
    renderExplorer(false);
    searchForSomethingMissing();

    expect(
      screen.queryByRole('button', { name: /即時抓取|Fetch/i })
    ).not.toBeInTheDocument();
  });

  it('never calls the sync service for an unauthenticated visitor', async () => {
    renderExplorer(false);
    searchForSomethingMissing();

    const anyButton = screen.queryByRole('button', { name: /即時抓取|Fetch/i });
    if (anyButton) fireEvent.click(anyButton);

    await waitFor(() => {
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it('offers the direct-fetch control to an authenticated admin', () => {
    renderExplorer(true);
    searchForSomethingMissing();

    expect(
      screen.getByRole('button', { name: /即時抓取|Fetch/i })
    ).toBeInTheDocument();
  });

  it('threads the auth state through VendorPage, which embeds ExplorerPage', () => {
    render(
      <VendorPage
        vendorCode="redhat"
        advisories={[]}
        cves={[]}
        taxonomy={[]}
        onSelectCve={vi.fn()}
        onSelectAdvisory={vi.fn()}
        isAuthenticated
      />
    );
    searchForSomethingMissing();

    expect(
      screen.getByRole('button', { name: /即時抓取|Fetch/i })
    ).toBeInTheDocument();
  });
});
