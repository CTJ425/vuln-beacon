import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '@/components/common/Sidebar';

describe('Sidebar version stays visible while the page scrolls', () => {
  it('pins the sidebar below the sticky header so the bottom-left version never scrolls away', () => {
    render(<Sidebar currentNav={{ section: 'dashboard' }} onSelectNav={vi.fn()} taxonomy={[]} />);

    const sidebar = screen.getByTestId('sidebar-container');
    expect(sidebar).toHaveStyle({ position: 'sticky', top: '64px', alignSelf: 'flex-start' });
    expect(sidebar).toContainElement(screen.getByTestId('sidebar-version'));
  });
});
