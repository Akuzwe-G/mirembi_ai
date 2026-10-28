import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteOfflineCopy, offlineCopyDate, saveOfflineCopy, unlockOfflineCopy } from '../../resources/js/offline-vault';
import { access, snapshot } from './fixtures';

beforeEach(async () => { vi.stubGlobal('crypto', webcrypto); await deleteOfflineCopy(); });
describe('explicit encrypted device copies', () => {
  it('starts empty and requires an intentional save with a strong passphrase', async () => {
    expect(await offlineCopyDate()).toBeNull();
    await expect(saveOfflineCopy(snapshot, 'short')).rejects.toThrow('at least 12');
    expect(await offlineCopyDate()).toBeNull();
  });
  it('round-trips saved information, strips unrelated fields and never stores plaintext or tokens', async () => {
    await saveOfflineCopy({ ...snapshot, access_token: access.access_token } as typeof snapshot, 'a private passphrase');
    const opened = await unlockOfflineCopy('a private passphrase');
    expect(opened.messages).toEqual(snapshot.messages);
    expect(opened.concerns).toEqual(snapshot.concerns);
    expect(JSON.stringify(opened)).not.toContain(access.access_token);
    const raw = await new Promise<unknown>((resolve, reject) => {
      const opening = indexedDB.open('mirembe-private-offline-v1', 1);
      opening.onsuccess = () => { const db = opening.result; const request = db.transaction('vault').objectStore('vault').get('journey'); request.onsuccess = () => { resolve(request.result); db.close(); }; request.onerror = reject; };
    });
    expect(JSON.stringify(raw)).not.toContain(snapshot.messages[0].content);
    expect(JSON.stringify(raw)).not.toContain(access.access_token);
    const encryptedBytes = (raw as { ciphertext: ArrayBuffer }).ciphertext;
    expect(new TextDecoder().decode(encryptedBytes)).not.toContain(snapshot.messages[0].content);
    expect(new TextDecoder().decode(encryptedBytes)).not.toContain(access.access_token);
    await expect(unlockOfflineCopy('a different passphrase')).rejects.toThrow('Could not unlock');
    await deleteOfflineCopy();
    expect(await offlineCopyDate()).toBeNull();
  });
  it('invalidates and removes expired device copies after seven days', async () => {
    await saveOfflineCopy(snapshot, 'a private passphrase');
    const spy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(await offlineCopyDate()).toBeNull();
    await expect(unlockOfflineCopy('a private passphrase')).rejects.toThrow('No saved');
    spy.mockRestore();
  });
});
