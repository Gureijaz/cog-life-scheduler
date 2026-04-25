import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmationCard from './ConfirmationCard';
import type { AIResponse } from '@/lib/types';

function makeResponse(overrides: Partial<AIResponse> = {}): AIResponse {
  return {
    intent: 'create',
    confirmationRequired: true,
    summary: 'Create a new gym session on Monday at 6 PM',
    ...overrides,
  };
}

describe('ConfirmationCard', () => {
  it('renders the summary of proposed changes', () => {
    render(<ConfirmationCard response={makeResponse()} onConfirm={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('Create a new gym session on Monday at 6 PM')).toBeInTheDocument();
  });

  it('renders the intent action when not unknown', () => {
    render(<ConfirmationCard response={makeResponse({ intent: 'reschedule' })} onConfirm={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('reschedule')).toBeInTheDocument();
  });

  it('does not render intent when intent is unknown', () => {
    const { container } = render(
      <ConfirmationCard response={makeResponse({ intent: 'unknown' })} onConfirm={vi.fn()} onReject={vi.fn()} />,
    );
    expect(container.querySelector('.confirmation-card__intent')).not.toBeInTheDocument();
  });

  it('calls onConfirm when Confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmationCard response={makeResponse()} onConfirm={onConfirm} onReject={vi.fn()} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onReject when Cancel button is clicked', () => {
    const onReject = vi.fn();
    render(<ConfirmationCard response={makeResponse()} onConfirm={vi.fn()} onReject={onReject} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onReject).toHaveBeenCalledOnce();
  });

  it('renders both Confirm and Cancel buttons', () => {
    render(<ConfirmationCard response={makeResponse()} onConfirm={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });
});
