import { webcrypto } from 'node:crypto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DeviceCopy } from '../../resources/js/components/DeviceCopy';
import { deleteOfflineCopy, saveOfflineCopy } from '../../resources/js/offline-vault';
import { snapshot } from './fixtures';

it('removes unlocked information from the page when the online journey clears its device copy', async () => {
  vi.stubGlobal('crypto', webcrypto);
  await saveOfflineCopy(snapshot, 'a private passphrase');
  render(<DeviceCopy online={false} />);
  const password = await screen.findByLabelText('Unlock saved offline copy');
  fireEvent.change(password, { target: { value: 'a private passphrase' } });
  fireEvent.click(screen.getByRole('button', { name: 'Unlock read-only copy' }));
  expect(await screen.findByText(snapshot.messages[0].content)).toBeInTheDocument();
  await deleteOfflineCopy();
  act(() => window.dispatchEvent(new Event('mirembe:device-copy-changed')));
  await waitFor(() => expect(screen.queryByText(snapshot.messages[0].content)).not.toBeInTheDocument());
  expect(await screen.findByText('No journey has been saved offline on this device.')).toBeInTheDocument();
});
