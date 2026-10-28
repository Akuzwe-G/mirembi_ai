import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PwaControls } from '../../resources/js/components/PwaControls';
import { OfflineScreen } from '../../resources/js/components/OfflineScreen';

describe('PWA installation and offline guidance', () => {
  it('offers the captured install prompt only after the user chooses install', async () => {
    render(<PwaControls busy={false} />);
    const event = new Event('beforeinstallprompt', { cancelable: true });
    const prompt = vi.fn().mockResolvedValue(undefined);
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    act(() => window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Install Mirembe' })));
    expect(prompt).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event('appinstalled')));
    expect(screen.queryByText('A little space on your home screen.')).not.toBeInTheDocument();
  });
  it('explains Safari installation and hides instructions in standalone mode', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari');
    const view = render(<PwaControls busy={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Install on iPhone or iPad' }));
    expect(screen.getByText(/Tap Share, then Add to Home Screen/)).toBeInTheDocument();
    view.unmount();
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<PwaControls busy={false} />);
    expect(screen.queryByRole('button', { name: 'Install on iPhone or iPad' })).not.toBeInTheDocument();
  });
  it('defers an update while a draft or request is active', () => {
    render(<PwaControls busy />);
    act(() => window.dispatchEvent(new Event('mirembe:update-ready')));
    expect(screen.getByRole('button', { name: 'Update and reload' })).toBeDisabled();
  });
  it('states that AI needs a connection and does not provide offline message sending', async () => {
    render(<OfflineScreen />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('offline');
    expect(screen.getByText(/Nothing will be sent or queued/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Your message to Mirembe' })).not.toBeInTheDocument();
    expect(await screen.findByText('No journey has been saved offline on this device.')).toBeInTheDocument();
  });
});
