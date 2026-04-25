import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BlockDetail from './BlockDetail';
import type { ScheduleBlock } from '@/lib/types';

// Mock the useExplanation hook
const mockUseExplanation = vi.fn();
vi.mock('@/hooks/useSchedule', () => ({
  useExplanation: (...args: unknown[]) => mockUseExplanation(...args),
}));

function makeBlock(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: 'block-1',
    planId: 'plan-1',
    sourceType: 'fixed_event',
    sourceId: 'src-1',
    title: 'Morning Lecture',
    startTime: '09:00',
    endTime: '10:30',
    locationId: null,
    locked: false,
    sortOrder: 0,
    ...overrides,
  };
}

describe('BlockDetail', () => {
  beforeEach(() => {
    mockUseExplanation.mockReset();
  });

  it('displays block title and time range', () => {
    mockUseExplanation.mockReturnValue({ explanation: null, loading: false, error: null });
    render(<BlockDetail block={makeBlock()} onClose={vi.fn()} />);
    expect(screen.getByText('Morning Lecture')).toBeInTheDocument();
    expect(screen.getByText('9:00 AM – 10:30 AM')).toBeInTheDocument();
  });

  it('displays explanation text when loaded', () => {
    mockUseExplanation.mockReturnValue({
      explanation: {
        id: 'exp-1',
        blockId: 'block-1',
        explanationText: 'Placed here due to Fixed_Event conflict with Travel_Rule between Home and University.',
        referencedConstraints: ['Fixed_Event conflict', 'Travel_Rule'],
        createdAt: '2025-01-01',
      },
      loading: false,
      error: null,
    });
    render(<BlockDetail block={makeBlock()} onClose={vi.fn()} />);
    expect(
      screen.getByText('Placed here due to Fixed_Event conflict with Travel_Rule between Home and University.'),
    ).toBeInTheDocument();
  });

  it('shows loading state while explanation is loading', () => {
    mockUseExplanation.mockReturnValue({ explanation: null, loading: true, error: null });
    render(<BlockDetail block={makeBlock()} onClose={vi.fn()} />);
    expect(screen.getByText('Loading explanation…')).toBeInTheDocument();
  });

  it('shows "No explanation available" when no explanation exists', () => {
    mockUseExplanation.mockReturnValue({ explanation: null, loading: false, error: null });
    render(<BlockDetail block={makeBlock()} onClose={vi.fn()} />);
    expect(screen.getByText('No explanation available.')).toBeInTheDocument();
  });

  it('shows locked status for locked block', () => {
    mockUseExplanation.mockReturnValue({ explanation: null, loading: false, error: null });
    render(<BlockDetail block={makeBlock({ locked: true })} onClose={vi.fn()} />);
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('shows unlocked status for unlocked block', () => {
    mockUseExplanation.mockReturnValue({ explanation: null, loading: false, error: null });
    render(<BlockDetail block={makeBlock({ locked: false })} onClose={vi.fn()} />);
    expect(screen.getByText('Unlocked')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    mockUseExplanation.mockReturnValue({ explanation: null, loading: false, error: null });
    const onClose = vi.fn();
    render(<BlockDetail block={makeBlock()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close detail panel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onLockToggle with block id and current locked state', () => {
    mockUseExplanation.mockReturnValue({ explanation: null, loading: false, error: null });
    const onLockToggle = vi.fn();
    render(<BlockDetail block={makeBlock({ locked: false })} onClose={vi.fn()} onLockToggle={onLockToggle} />);
    fireEvent.click(screen.getByText('Lock Block'));
    expect(onLockToggle).toHaveBeenCalledWith('block-1', false);
  });
});
