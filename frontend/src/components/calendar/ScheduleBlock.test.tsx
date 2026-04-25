import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScheduleBlock from './ScheduleBlock';
import type { ScheduleBlock as ScheduleBlockType } from '@/lib/types';

function makeBlock(overrides: Partial<ScheduleBlockType> = {}): ScheduleBlockType {
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

describe('ScheduleBlock', () => {
  it('renders title and time range', () => {
    render(<ScheduleBlock block={makeBlock()} />);
    expect(screen.getByText('Morning Lecture')).toBeInTheDocument();
    expect(screen.getByText('9:00 AM – 10:30 AM')).toBeInTheDocument();
  });

  it('applies fixed-event color class for fixed_event source type', () => {
    const { container } = render(<ScheduleBlock block={makeBlock({ sourceType: 'fixed_event' })} />);
    expect(container.querySelector('.schedule-block--fixed-event')).toBeInTheDocument();
  });

  it('applies flexible-task color class for flexible_task source type', () => {
    const { container } = render(<ScheduleBlock block={makeBlock({ sourceType: 'flexible_task' })} />);
    expect(container.querySelector('.schedule-block--flexible-task')).toBeInTheDocument();
  });

  it('applies assignment color class for assignment source type', () => {
    const { container } = render(<ScheduleBlock block={makeBlock({ sourceType: 'assignment' })} />);
    expect(container.querySelector('.schedule-block--assignment')).toBeInTheDocument();
  });

  it('applies travel-buffer color class for travel_buffer source type', () => {
    const { container } = render(<ScheduleBlock block={makeBlock({ sourceType: 'travel_buffer' })} />);
    expect(container.querySelector('.schedule-block--travel-buffer')).toBeInTheDocument();
  });

  it('shows lock indicator when block is locked', () => {
    const { container } = render(<ScheduleBlock block={makeBlock({ locked: true })} />);
    expect(container.querySelector('.schedule-block__lock')).toBeInTheDocument();
  });

  it('does not show lock indicator when block is unlocked', () => {
    const { container } = render(<ScheduleBlock block={makeBlock({ locked: false })} />);
    expect(container.querySelector('.schedule-block__lock')).not.toBeInTheDocument();
  });

  it('shows correct source type badge label', () => {
    render(<ScheduleBlock block={makeBlock({ sourceType: 'assignment' })} />);
    expect(screen.getByText('Assignment')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const block = makeBlock();
    render(<ScheduleBlock block={block} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(block);
  });

  it('includes locked status in aria-label when locked', () => {
    render(<ScheduleBlock block={makeBlock({ locked: true })} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toContain('locked');
  });
});
