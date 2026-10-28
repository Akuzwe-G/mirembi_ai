import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../resources/js/App';
import { readGuest, saveGuest } from '../../resources/js/guest-storage';
import { access, analysis, concern, snapshot } from './fixtures';

function response(body: unknown, status = 200) { return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });

async function begin() {
  fetchMock.mockResolvedValueOnce(response({ ...access, phase: 'express' }));
  const user = userEvent.setup();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Enable microphone' })).toBeEnabled());
  await user.click(await screen.findByRole('button', { name: 'Type instead' }));
  await screen.findByRole('textbox', { name: 'Your message to Mirembe' });
  return user;
}
async function restored() {
  saveGuest(access, analysis);
  fetchMock.mockResolvedValueOnce(response(snapshot));
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Type instead' }));
  await screen.findByText(analysis.reflection);
  return userEvent.setup();
}

describe('Mirembe guest experience', () => {
  it('creates a journey without sending a model request and remembers tab access', async () => {
    render(<App />);
    await begin();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/journeys');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
    expect(readGuest()?.access).toEqual(access);
    expect(screen.getByText('I’m glad you’re here.')).toBeInTheDocument();
  });

  it('shows structured analysis, lifecycle states and optional grounding without creating a plan', async () => {
    render(<App />);
    const user = await begin();
    let finish!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await user.type(screen.getByRole('textbox'), 'Studies and work feel overwhelming.');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.getByRole('img', { name: 'Mirembe avatar placeholder: thinking' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sending message' })).toBeDisabled();
    await act(async () => finish(response({ phase: 'clarify', analysis, concerns: [concern] })));
    expect(await screen.findByText(analysis.reflection)).toBeInTheDocument();
    expect(screen.getByText(analysis.clarification_question!)).toBeInTheDocument();
    expect(screen.getByText(analysis.next_action!)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mirembe avatar placeholder: idle' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Clarity Map' }));
    expect(screen.getByText('Needs your review')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Conversation' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe(`/api/journeys/${access.journey_id}/messages`);
    expect(String(url)).not.toContain(access.access_token);
    expect(options?.headers).toMatchObject({ Authorization: `Bearer ${access.access_token}` });
    expect(screen.getByRole('textbox')).toHaveValue('');
    fetchMock.mockResolvedValueOnce(response({ phase: 'clarify', analysis: { ...analysis, next_action: null }, concerns: [concern] }));
    await user.type(screen.getByRole('textbox'), 'Friday comes first.');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
    expect(fetchMock.mock.calls.some(([path]) => String(path).endsWith('/actions'))).toBe(false);
  });

  it('preserves a failed draft and allows an explicit retry after 503', async () => {
    render(<App />);
    const user = await begin();
    fetchMock.mockResolvedValueOnce(response({}, 503));
    await user.type(screen.getByRole('textbox'), 'Keep my words');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your journey is unchanged');
    expect(screen.getByRole('textbox')).toHaveValue('Keep my words');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockResolvedValueOnce(response({ phase: 'clarify', analysis, concerns: [concern] }));
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText(analysis.reflection)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('requires restoration before resending after an ambiguous network failure', async () => {
    render(<App />);
    const user = await begin();
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await user.type(screen.getByRole('textbox'), 'An uncertain request');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('refresh this journey');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    fetchMock.mockResolvedValueOnce(response({ ...snapshot, messages: [], concerns: [] }));
    await user.click(screen.getByRole('button', { name: 'Refresh journey' }));
    expect(await screen.findByRole('textbox')).toHaveValue('An uncertain request');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
  });

  it('restores the conversation, concerns and latest clarification after remount', async () => {
    saveGuest(access, analysis);
    fetchMock.mockImplementation(async () => response(snapshot));
    const first = render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Type instead' }));
    await screen.findByText(analysis.clarification_question!);
    first.unmount();
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Type instead' }));
    expect(await screen.findByText('I have an assignment due.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Clarity Map' }));
    expect(screen.getByText('Coursework')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Conversation' }));
    expect(screen.getByText(analysis.clarification_question!)).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  });

  it('edits all concern fields, requires review, and confirms through the existing endpoint', async () => {
    const user = await restored();
    await user.click(screen.getByRole('tab', { name: 'Clarity Map' }));
    await user.click(screen.getByRole('button', { name: 'Edit Coursework' }));
    await user.clear(screen.getByLabelText('Concern'));
    await user.type(screen.getByLabelText('Concern'), 'Assignment brief');
    await user.clear(screen.getByLabelText('Category'));
    await user.type(screen.getByLabelText('Category'), 'study');
    const updated = { ...concern, title: 'Assignment brief', category: 'study' };
    fetchMock.mockResolvedValueOnce(response(updated));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Assignment brief');
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1]!.body as string)).toMatchObject({ category: 'study', confirmed: false });
    fetchMock.mockResolvedValueOnce(response({ phase: 'focus', concerns: [{ ...updated, confirmed: true }] }));
    await user.click(screen.getByRole('button', { name: 'Confirm Assignment brief' }));
    expect(await screen.findByText('Confirmed by you')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Assignment brief' })).toBeInTheDocument();
  });

  it('saves an action only when chosen and lets the user complete it', async () => {
    const user = await restored();
    const action = { id: 7, title: analysis.next_action, status: 'pending' };
    fetchMock.mockResolvedValueOnce(response(action, 201));
    await user.click(screen.getByRole('button', { name: /Make this my next step/ }));
    await user.click(screen.getByRole('tab', { name: 'Clarity Map' }));
    const complete = await screen.findByRole('button', { name: `Complete action: ${analysis.next_action}` });
    expect(screen.getByText('Steps you’ve chosen')).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(response({ ...action, status: 'completed' }));
    await user.click(complete);
    expect(await screen.findByRole('button', { name: `Reopen action: ${analysis.next_action}` })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clears server data and tab access only after explicit confirmation', async () => {
    const user = await restored();
    await user.click(screen.getByRole('button', { name: 'Close My Journey' }));
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('button', { name: 'Delete my data' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(response(null, 204));
    await user.click(screen.getByRole('button', { name: 'Delete my journey' }));
    expect(await screen.findByRole('button', { name: 'Enable microphone' })).toBeInTheDocument();
    expect(readGuest()).toBeNull();
    expect(fetchMock.mock.calls.at(-1)![1]?.method).toBe('DELETE');
  });

  it('keeps access when deletion fails and never claims the journey was cleared', async () => {
    const user = await restored();
    await user.click(screen.getByRole('button', { name: 'Close My Journey' }));
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('button', { name: 'Delete my data' }));
    fetchMock.mockResolvedValueOnce(response({}, 500));
    await user.click(screen.getByRole('button', { name: 'Delete my journey' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(readGuest()?.access).toEqual(access);
    expect(screen.getByRole('button', { name: 'Delete my journey' })).toBeInTheDocument();
  });

  it('treats model content as text and never starts the microphone', async () => {
    saveGuest(access);
    fetchMock.mockResolvedValueOnce(response({ ...snapshot, messages: [{ id: 2, role: 'assistant', content: '<img src=x onerror=alert(1)>' }] }));
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Type instead' }));
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Close My Journey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enable microphone' }));
    expect(screen.getByText(/Hands-free recognition is not available/)).toBeInTheDocument();
  });
});
