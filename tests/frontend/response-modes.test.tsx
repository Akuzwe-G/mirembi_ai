import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../../resources/js/App';
import { access, analysis } from './fixtures';
import { readVoicePreferences } from '../../resources/js/voice/languages';

function speech() {
  const utterances: SpeechSynthesisUtterance[] = [];
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => [{ lang: 'en-US', localService: true }, { lang: 'fr-FR', localService: true }, { lang: 'hi-IN', localService: true }],
    addEventListener: vi.fn(), removeEventListener: vi.fn(), resume: vi.fn(), cancel: vi.fn(),
    speak: (value: SpeechSynthesisUtterance) => { if (!value.text.trim()) return; utterances.push(value); queueMicrotask(() => { value.onstart?.({} as SpeechSynthesisEvent); value.onend?.({} as SpeechSynthesisEvent); }); },
  });
  return utterances;
}
function api(result = analysis) {
  const response = (body: unknown) => new Response(JSON.stringify(body));
  const fetch = vi.fn().mockResolvedValueOnce(response({ ...access, phase: 'express' })).mockResolvedValueOnce(response({ phase: 'clarify', analysis: result, concerns: [] }));
  vi.stubGlobal('fetch', fetch); return fetch;
}

describe('independent response choices', () => {
  for (const [mode, label] of [['text', 'Text'], ['voice', 'Voice'], ['both', 'Both']] as const) it(`types English with ${mode} output, retains the mode and does not repeat audio on rerender`, async () => {
    const utterances = speech(); const fetch = api(); const user = userEvent.setup(); const view = render(<App />);
    await user.click(within(screen.getByRole('main')).getByRole('radio', { name: label }));
    await user.click(screen.getByRole('button', { name: 'Type instead' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('radio', { name: label })).toBeChecked();
    await waitFor(() => expect(dialog.getByRole('textbox')).toBeEnabled());
    await user.type(dialog.getByRole('textbox'), 'A fictional English message.');
    await user.click(dialog.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(dialog.getByRole('textbox')).toHaveValue(''));
    if (mode === 'voice') expect(dialog.getByText('Written reply / accessible captions')).toBeInTheDocument();
    else expect(dialog.getByText(analysis.reflection)).toBeVisible();
    await waitFor(() => expect(utterances).toHaveLength(mode === 'text' ? 0 : 1));
    if (mode !== 'text') expect(utterances[0].text).toBe(`${analysis.reflection} ${analysis.clarification_question}`);
    view.rerender(<App />);
    expect(utterances).toHaveLength(mode === 'text' ? 0 : 1); expect(fetch).toHaveBeenCalledTimes(2);
    expect(readVoicePreferences().responseMode).toBe(mode);
  });
  it('uses Auto typed French and the validated response language to select a French voice', async () => {
    const utterances = speech(); const result = { ...analysis, response_language: 'fr' as const, reflection: 'Nous pouvons en parler.', clarification_question: 'Qu’est-ce qui compte pour vous ?' };
    const fetch = api(result); const user = userEvent.setup(); render(<App />);
    await user.selectOptions(within(screen.getByRole('main')).getByLabelText('Conversation language'), 'auto');
    await user.click(screen.getByRole('button', { name: 'Type instead' }));
    const dialog = within(screen.getByRole('dialog')); await waitFor(() => expect(dialog.getByRole('textbox')).toBeEnabled());
    await user.type(dialog.getByRole('textbox'), 'Je prépare un examen fictif.');
    await user.click(dialog.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(utterances).toHaveLength(1));
    expect(utterances[0].lang).toBe('fr-FR');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ language: 'auto', input_method: 'typing' });
    await user.click(dialog.getByRole('button', { name: 'Close My Journey' }));
    await user.click(screen.getByRole('button', { name: 'Language and voice settings' }));
    const diagnostics = within(screen.getByRole('dialog'));
    expect(diagnostics.getByText('Language diagnostics · development only')).toBeInTheDocument();
    expect(diagnostics.getByText('fr (model-identified from text)')).toBeInTheDocument();
    expect(diagnostics.getByText('fr-FR', { selector: 'dd' })).toBeInTheDocument();
  });
  it('keeps Kinyarwanda text available and explains a missing voice without reading it as English', async () => {
    const utterances = speech(); api({ ...analysis, response_language: 'rw', reflection: 'Dushobora kubiganiraho.' });
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('button', { name: 'Type instead' }));
    const dialog = within(screen.getByRole('dialog')); await waitFor(() => expect(dialog.getByRole('textbox')).toBeEnabled());
    await user.selectOptions(dialog.getByLabelText('Conversation language'), 'auto');
    await user.type(dialog.getByRole('textbox'), 'Mfite ikizamini.');
    await user.click(dialog.getByRole('button', { name: 'Send message' }));
    expect(await dialog.findByText('Dushobora kubiganiraho.')).toBeVisible();
    expect(await dialog.findByText(/No matching rw speech voice/)).toBeVisible();
    expect(utterances).toHaveLength(0);
  });
  it('restores language and mode preferences without starting audio on page load', async () => {
    localStorage.setItem('mirembe.voice-preferences.v1', JSON.stringify({ language: 'hi-IN', voicePreferred: false, responseMode: 'voice' }));
    const utterances = speech(); vi.stubGlobal('fetch', vi.fn()); render(<App />);
    expect(screen.getByLabelText('Conversation language')).toHaveValue('hi-IN');
    expect(screen.getByRole('radio', { name: 'Voice' })).toBeChecked();
    expect(utterances).toHaveLength(0);
  });
  it('keeps language and response choices after remount without playing audio', async () => {
    const utterances = speech(); vi.stubGlobal('fetch', vi.fn()); const user = userEvent.setup();
    const first = render(<App />);
    await user.selectOptions(screen.getByLabelText('Conversation language'), 'fr-FR');
    await user.click(screen.getByRole('radio', { name: 'Voice' }));
    first.unmount(); render(<App />);
    expect(screen.getByLabelText('Conversation language')).toHaveValue('fr-FR');
    expect(screen.getByRole('radio', { name: 'Voice' })).toBeChecked();
    expect(utterances).toHaveLength(0);
  });
  it('switches response languages in one guest journey without changing output mode or guest access', async () => {
    speech();
    const fetch = api({ ...analysis, response_language: 'fr', reflection: 'Nous pouvons en parler.' });
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ phase: 'clarify', analysis: { ...analysis, response_language: 'rw', reflection: 'Dushobora kubiganiraho.' }, concerns: [] })));
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('button', { name: 'Type instead' }));
    const dialog = within(screen.getByRole('dialog')); await waitFor(() => expect(dialog.getByRole('textbox')).toBeEnabled());
    await user.selectOptions(dialog.getByLabelText('Conversation language'), 'auto');
    await user.type(dialog.getByRole('textbox'), 'Bonjour.'); await user.click(dialog.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(dialog.getByRole('textbox')).toHaveValue(''));
    await user.selectOptions(dialog.getByLabelText('Conversation language'), 'rw-RW');
    await user.type(dialog.getByRole('textbox'), 'Mfite ikizamini.'); await user.click(dialog.getByRole('button', { name: 'Send message' }));
    expect(await dialog.findByText('Dushobora kubiganiraho.')).toBeVisible();
    expect(fetch.mock.calls[1][0]).toBe(fetch.mock.calls[2][0]);
    expect(dialog.getByRole('radio', { name: 'Both' })).toBeChecked();
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toMatchObject({ language: 'rw-RW' });
  });
});
