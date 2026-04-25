import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageBubble from './MessageBubble';
import type { ChatMessage } from '@/hooks/useChat';

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    text: 'Move gym to tomorrow',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('MessageBubble', () => {
  it('renders message text', () => {
    render(<MessageBubble message={makeMessage()} />);
    expect(screen.getByText('Move gym to tomorrow')).toBeInTheDocument();
  });

  it('applies user styling class for user messages', () => {
    const { container } = render(<MessageBubble message={makeMessage({ role: 'user' })} />);
    expect(container.querySelector('.chat-bubble--user')).toBeInTheDocument();
    expect(container.querySelector('.chat-bubble--assistant')).not.toBeInTheDocument();
  });

  it('applies assistant styling class for assistant messages', () => {
    const { container } = render(
      <MessageBubble message={makeMessage({ role: 'assistant', text: 'Sure, I can do that.' })} />,
    );
    expect(container.querySelector('.chat-bubble--assistant')).toBeInTheDocument();
    expect(container.querySelector('.chat-bubble--user')).not.toBeInTheDocument();
  });

  it('renders follow-up question when present in aiResponse', () => {
    render(
      <MessageBubble
        message={makeMessage({
          role: 'assistant',
          text: 'I can create that event.',
          aiResponse: {
            intent: 'create',
            confirmationRequired: false,
            summary: 'I can create that event.',
            followUpQuestion: 'What time should it start?',
          },
        })}
      />,
    );
    expect(screen.getByText('What time should it start?')).toBeInTheDocument();
  });

  it('does not render follow-up section when no aiResponse', () => {
    const { container } = render(<MessageBubble message={makeMessage()} />);
    expect(container.querySelector('.chat-bubble__followup')).not.toBeInTheDocument();
  });
});
