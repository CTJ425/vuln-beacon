import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme/ThemeContext';
import { Header, HeaderProps } from '@/components/common/Header';

describe('Header Component (TDD - R4 / R2)', () => {
  const renderHeader = (props: HeaderProps = {}) => {
    return render(
      <ThemeProvider>
        <Header {...props} />
      </ThemeProvider>
    );
  };

  describe('Branding & Info Section', () => {
    it('renders the VulnBeacon title', () => {
      renderHeader();
      expect(screen.getByText('VulnBeacon')).toBeInTheDocument();
    });

    it('renders the shift schedule information', () => {
      renderHeader();
      expect(screen.getByText(/Daily Shifts/i)).toBeInTheDocument();
    });

    it('renders the theme switcher component', () => {
      renderHeader();
      expect(screen.getByRole('group', { name: /theme mode switcher/i })).toBeInTheDocument();
    });
  });

  describe('R4: GitHub Repository Link Button', () => {
    it('renders a clickable link element pointing to the GitHub repository', () => {
      renderHeader();
      const link = screen.getByRole('link', { name: /github repository/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://github.com/CTJ425/vuln-beacon');
    });

    it('opens GitHub link in a new tab with secure rel attributes', () => {
      renderHeader();
      const link = screen.getByRole('link', { name: /github repository/i });
      expect(link).toHaveAttribute('target', '_blank');
      const rel = link.getAttribute('rel') || '';
      expect(rel).toContain('noopener');
      expect(rel).toContain('noreferrer');
    });

    it('contains a GitHub icon inside the link', () => {
      const { container } = renderHeader();
      const githubIcon = container.querySelector('svg.lucide-github');
      expect(githubIcon).toBeInTheDocument();
    });

    it('has data-testid="header-github-link"', () => {
      renderHeader();
      const link = screen.getByTestId('header-github-link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://github.com/CTJ425/vuln-beacon');
    });

    it('does NOT render the old notification bell icon or button', () => {
      const { container } = renderHeader();
      expect(screen.queryByRole('button', { name: /bell|notification/i })).not.toBeInTheDocument();
      expect(container.querySelector('svg.lucide-bell')).not.toBeInTheDocument();
    });
  });

  describe('R2: Role-Gated Manual Sync Removal from Public Header', () => {
    it('does NOT render the public "Sync All Feeds" button', () => {
      renderHeader();
      expect(screen.queryByRole('button', { name: /sync all feeds/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/sync all feeds/i)).not.toBeInTheDocument();
    });

    it('does NOT render sync button even if onManualSync is provided', () => {
      const handleManualSync = vi.fn();
      renderHeader({ onManualSync: handleManualSync });
      expect(screen.queryByRole('button', { name: /sync all feeds/i })).not.toBeInTheDocument();
      expect(handleManualSync).not.toHaveBeenCalled();
    });

    it('does NOT render "Syncing..." status text even if isSyncing={true} is provided', () => {
      renderHeader({ isSyncing: true });
      expect(screen.queryByText(/syncing\.\.\./i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /syncing/i })).not.toBeInTheDocument();
    });
  });

  describe('Props and Backward Compatibility', () => {
    it('renders cleanly without any props provided', () => {
      expect(() => renderHeader()).not.toThrow();
    });

    it('renders cleanly when deprecated props are passed', () => {
      expect(() => renderHeader({ onManualSync: () => {}, isSyncing: false })).not.toThrow();
    });
  });

  describe('Sidebar Toggle Button Support', () => {
    it('does NOT render sidebar toggle button when onToggleSidebar is not provided', () => {
      renderHeader();
      expect(screen.queryByTestId('header-sidebar-toggle')).not.toBeInTheDocument();
    });

    it('renders sidebar toggle button when onToggleSidebar is provided', () => {
      const handleToggle = vi.fn();
      renderHeader({ onToggleSidebar: handleToggle, isSidebarCollapsed: false });
      const toggleBtn = screen.getByTestId('header-sidebar-toggle');
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveAttribute('aria-label', expect.stringMatching(/收起|collapse/i));
    });

    it('updates aria-label when isSidebarCollapsed is true', () => {
      const handleToggle = vi.fn();
      renderHeader({ onToggleSidebar: handleToggle, isSidebarCollapsed: true });
      const toggleBtn = screen.getByTestId('header-sidebar-toggle');
      expect(toggleBtn).toHaveAttribute('aria-label', expect.stringMatching(/展開|expand/i));
    });

    it('calls onToggleSidebar when toggle button is clicked', () => {
      const handleToggle = vi.fn();
      renderHeader({ onToggleSidebar: handleToggle });
      const toggleBtn = screen.getByTestId('header-sidebar-toggle');
      fireEvent.click(toggleBtn);
      expect(handleToggle).toHaveBeenCalledTimes(1);
    });
  });
});

