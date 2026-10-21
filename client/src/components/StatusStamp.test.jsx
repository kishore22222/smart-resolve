import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusStamp from './StatusStamp.jsx';
import PriorityBadge from './PriorityBadge.jsx';

describe('StatusStamp', () => {
  it('renders the human label and exposes the status', () => {
    render(<StatusStamp status="IN_PROGRESS" />);
    expect(screen.getByText('In progress')).toHaveAttribute('data-status', 'IN_PROGRESS');
  });

  it('marks the flash animation when requested', () => {
    render(<StatusStamp status="SUBMITTED" flash />);
    expect(screen.getByText('Submitted')).toHaveAttribute('data-flash', 'true');
  });
});

describe('PriorityBadge', () => {
  it('renders the priority label', () => {
    render(<PriorityBadge priority="high" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });
});
