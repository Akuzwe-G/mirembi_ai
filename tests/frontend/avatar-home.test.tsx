import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../../resources/js/App';
import { access, analysis } from './fixtures';

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Server-Timing': 'meta;dur=15.000, validation;dur=1.000, backend;dur=2.000' } });

describe('avatar-first entry and languages', () => {
  it('shows one avatar immediately, no mandatory onboarding, history, map, API or audio activity', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<App />);
    expect(screen.getAllByRole('img', { name: /Mirembe avatar placeholder/ })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('What’s on your mind?');
    expect(screen.getByRole('button', { name: 'Enable microphone' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Begin.*journey/i })).toBeNull();
    expect(screen.queryByRole('log')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enable microphone' })).toBeEnabled());
    expect(fetch).not.toHaveBeenCalled();
  });
  for (const [language, message, reply] of [
    ['en-US', 'A fictional deadline is close.', 'Let us look at one thing.'],
    ['fr-FR', 'Je prépare un examen fictif.', 'Nous pouvons avancer doucement.'],
    ['rw-RW', 'Mfite ikizamini.', 'Dushobora kubiganiraho.'],
  ]) it(`keeps ${language} text and passes explicitly selected context without claiming detection`, async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ ...access, phase: 'express' })).mockResolvedValueOnce(json({ phase: 'clarify', analysis: { ...analysis, reflection: reply }, concerns: [] }));
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('button', { name: 'Language and voice settings' }));
    await user.selectOptions(screen.getByLabelText('Conversation language'), language);
    expect(screen.getByText(/Automatic spoken-language detection is not configured/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close Settings' }));
    await user.click(screen.getByRole('button', { name: 'Type instead' }));
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    await user.type(screen.getByRole('textbox'), message);
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText(reply)).toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ message, language, language_source: 'user_selected' });
    expect(JSON.parse(localStorage.getItem('mirembe.voice-preferences.v1')!)).toEqual({ language, voicePreferred: false });
    expect(localStorage.getItem('mirembe.voice-preferences.v1')).not.toContain(message);
  });
  it('remembers language without starting capture and provides honest account placeholders', async () => {
    localStorage.setItem('mirembe.voice-preferences.v1', JSON.stringify({ language: 'fr-FR', voicePreferred: true }));
    render(<App />); const user = userEvent.setup();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bonjour');
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('button', { name: /^Sign in$/ }));
    expect(screen.getByText(/no credentials are collected/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    await act(async () => {});
  });
});
