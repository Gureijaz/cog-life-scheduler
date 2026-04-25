import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RepairSummary from './RepairSummary';
import type { ChangeSummary } from '@/lib/types';

function makeSummary(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
  return {
    moved: [],
    added: [],
    removed: [],
    ...overrides,
  };
}

describe('RepairSummary', () => {
  it('renders nothing when there are no changes', () => {
    const { container } = render(<RepairSummary summary={makeSummary()} />);
    expect(container.querySelector('.repair-summary')).not.toBeInTheDocument();
  });

  it('renders moved blocks section', () => {
    render(
      <RepairSummary
        summary={makeSummary({
          moved: [{ blockId: 'b1', oldStart: '09:00', newStart: '10:00' }],
        })}
      />,
    );
    expect(screen.getByText('Moved (1)')).toBeInTheDocument();
    expect(screen.getByText('Block moved from 09:00 → 10:00')).toBeInTheDocument();
  });

  it('renders added blocks section', () => {
    render(
      <RepairSummary summary={makeSummary({ added: ['b2', 'b3'] })} />,
    );
    expect(screen.getByText('Added (2)')).toBeInTheDocument();
  });

  it('renders removed blocks section', () => {
    render(
      <RepairSummary summary={makeSummary({ removed: ['b4'] })} />,
    );
    expect(screen.getByText('Removed (1)')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <RepairSummary
        summary={makeSummary({ added: ['b1'] })}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByLabelText('Dismiss repair summary'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('renders all sections when all change types present', () => {
    render(
      <RepairSummary
        summary={makeSummary({
          moved: [{ blockId: 'b1', oldStart: '08:00', newStart: '09:00' }],
          added: ['b2'],
          removed: ['b3'],
        })}
      />,
    );
    expect(screen.getByText('Moved (1)')).toBeInTheDocument();
    expect(screen.getByText('Added (1)')).toBeInTheDocument();
    expect(screen.getByText('Removed (1)')).toBeInTheDocument();
  });
});
