/**
 * Issue #561 — LiveModeView presentational shell (TDD Phase A §3.2).
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveModeView } from '../../src/live-mode/LiveModeView';

describe('LiveModeView (Issue #561)', () => {
  it('renders root with stable data-testid and region semantics', () => {
    render(
      <LiveModeView
        agentPresentation="idle"
        sessionPhase="disconnected"
        voicePhase="idle"
      />
    );
    const root = screen.getByTestId('live-mode-root');
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute('role', 'region');
    expect(root).toHaveAttribute('aria-label', 'Live voice mode');
  });

  it('shows voice phase in live-voice-state', () => {
    render(
      <LiveModeView
        agentPresentation="listening"
        sessionPhase="active"
        voicePhase="speaking"
      />
    );
    expect(screen.getByTestId('live-voice-state')).toHaveTextContent('speaking');
  });

  it('shows agent presentation in live-agent-state (including tool)', () => {
    const { rerender } = render(
      <LiveModeView
        agentPresentation="thinking"
        sessionPhase="active"
        voicePhase="idle"
      />
    );
    expect(screen.getByTestId('live-agent-state')).toHaveTextContent('thinking');

    rerender(
      <LiveModeView
        agentPresentation="tool"
        sessionPhase="active"
        voicePhase="idle"
      />
    );
    expect(screen.getByTestId('live-agent-state')).toHaveTextContent('tool');
  });

  it('shows session phase in live-session-phase', () => {
    const { rerender } = render(
      <LiveModeView
        agentPresentation="idle"
        sessionPhase="active"
        voicePhase="idle"
      />
    );
    expect(screen.getByTestId('live-session-phase')).toHaveTextContent('active');

    rerender(
      <LiveModeView
        agentPresentation="idle"
        sessionPhase="mic_off"
        voicePhase="idle"
      />
    );
    expect(screen.getByTestId('live-session-phase')).toHaveTextContent('mic_off');

    rerender(
      <LiveModeView
        agentPresentation="idle"
        sessionPhase="disconnected"
        voicePhase="idle"
      />
    );
    expect(screen.getByTestId('live-session-phase')).toHaveTextContent('disconnected');
  });

  it('renders end Live control when onEndLive is provided', async () => {
    const user = userEvent.setup();
    const onEndLive = jest.fn();
    render(
      <LiveModeView
        agentPresentation="speaking"
        sessionPhase="active"
        voicePhase="idle"
        onEndLive={onEndLive}
      />
    );
    const btn = screen.getByTestId('live-end-live-button');
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(onEndLive).toHaveBeenCalledTimes(1);
  });

  it('renders resume mic when onResumeMic is provided and session is mic_off or disconnected', () => {
    const onResumeMic = jest.fn();
    const { rerender } = render(
      <LiveModeView
        agentPresentation="idle"
        sessionPhase="mic_off"
        voicePhase="idle"
        onResumeMic={onResumeMic}
      />
    );
    expect(screen.getByTestId('live-resume-mic-button')).toBeInTheDocument();

    rerender(
      <LiveModeView
        agentPresentation="idle"
        sessionPhase="disconnected"
        voicePhase="idle"
        onResumeMic={onResumeMic}
      />
    );
    expect(screen.getByTestId('live-resume-mic-button')).toBeInTheDocument();
  });

  it('does not render resume mic when session is active', () => {
    render(
      <LiveModeView
        agentPresentation="listening"
        sessionPhase="active"
        voicePhase="idle"
        onResumeMic={jest.fn()}
      />
    );
    expect(screen.queryByTestId('live-resume-mic-button')).not.toBeInTheDocument();
  });

  it('labels mic vs assistant vs session so three idle values are not ambiguous', () => {
    render(
      <LiveModeView
        agentPresentation="idle"
        sessionPhase="active"
        voicePhase="idle"
      />
    );
    const root = screen.getByTestId('live-mode-root');
    expect(within(root).getByText('Mic activity')).toBeInTheDocument();
    expect(within(root).getByText('Assistant activity')).toBeInTheDocument();
    expect(within(root).getByText('Session')).toBeInTheDocument();
  });

  it('orders conversation history above activity status, then footer buttons below', () => {
    render(
      <LiveModeView
        agentPresentation="idle"
        sessionPhase="disconnected"
        voicePhase="idle"
        conversationMessages={[{ role: 'assistant', content: 'Hi' }]}
        onEndLive={jest.fn()}
        onResumeMic={jest.fn()}
      />
    );
    const main = screen.getByTestId('live-mode-main');
    const children = Array.from(main.children);
    const historyIdx = children.findIndex((el) => el.getAttribute('data-testid') === 'live-conversation-history');
    const statusIdx = children.findIndex((el) => el.getAttribute('data-testid') === 'live-activity-status');
    expect(historyIdx).toBeGreaterThanOrEqual(0);
    expect(statusIdx).toBeGreaterThanOrEqual(0);
    expect(historyIdx).toBeLessThan(statusIdx);
    const historyEl = screen.getByTestId('live-conversation-history');
    const footerEl = screen.getByTestId('live-mode-footer');
    expect(historyEl.compareDocumentPosition(footerEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('renders live-agent-visual and toggles animation driver via agentOutputActive', () => {
    const { rerender } = render(
      <LiveModeView
        agentPresentation="speaking"
        sessionPhase="active"
        voicePhase="idle"
        agentOutputActive={false}
      />
    );
    const visual = screen.getByTestId('live-agent-visual');
    expect(visual).toBeInTheDocument();

    rerender(
      <LiveModeView
        agentPresentation="speaking"
        sessionPhase="active"
        voicePhase="idle"
        agentOutputActive
      />
    );
    expect(screen.getByTestId('live-agent-visual')).toBe(visual);
  });

  it('renders conversation history in live-conversation-history', () => {
    render(
      <LiveModeView
        agentPresentation="idle"
        sessionPhase="active"
        voicePhase="idle"
        conversationMessages={[
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ]}
      />
    );
    const section = screen.getByTestId('live-conversation-history');
    expect(section).toBeInTheDocument();
    expect(screen.getByTestId('live-conversation-message-0')).toHaveTextContent('user:');
    expect(screen.getByTestId('live-conversation-message-0')).toHaveTextContent('Hello');
    expect(screen.getByTestId('live-conversation-message-1')).toHaveTextContent('assistant:');
  });

  it('anchors controls in live-mode-footer', () => {
    render(
      <LiveModeView
        agentPresentation="idle"
        sessionPhase="disconnected"
        voicePhase="idle"
        onEndLive={jest.fn()}
        onResumeMic={jest.fn()}
      />
    );
    const footer = screen.getByTestId('live-mode-footer');
    expect(footer).toContainElement(screen.getByTestId('live-end-live-button'));
    expect(footer).toContainElement(screen.getByTestId('live-resume-mic-button'));
  });
});
