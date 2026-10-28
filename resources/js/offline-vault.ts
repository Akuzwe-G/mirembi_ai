import type { Concern, JourneyAction, Message } from './types';

export interface OfflineJourney { version: 1; savedAt: string; messages: Message[]; concerns: Concern[]; actions: JourneyAction[] }
interface SealedJourney { version: 1; savedAt: string; salt: ArrayBuffer; iv: ArrayBuffer; ciphertext: ArrayBuffer }
const databaseName = 'mirembe-private-offline-v1';
const storeName = 'vault';
const retention = 7 * 24 * 60 * 60 * 1000;

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(databaseName, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(storeName);
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(new Error('Device storage is unavailable.'));
  });
}
async function entry(mode: IDBTransactionMode, value?: SealedJourney | null): Promise<SealedJourney | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = mode === 'readonly' ? store.get('journey') : value ? store.put(value, 'journey') : store.delete('journey');
    transaction.oncomplete = () => { db.close(); resolve(mode === 'readonly' ? request.result : undefined); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(new Error('Device storage could not be updated.')); };
  });
}
async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250_000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function offlineCopyDate(): Promise<string | null> {
  const saved = await entry('readonly');
  if (!saved) return null;
  if (saved.version !== 1 || !Number.isFinite(Date.parse(saved.savedAt)) || Date.now() - Date.parse(saved.savedAt) > retention) {
    await deleteOfflineCopy(); return null;
  }
  return saved.savedAt;
}
export async function saveOfflineCopy(data: Pick<OfflineJourney, 'messages' | 'concerns' | 'actions'>, passphrase: string): Promise<void> {
  if (passphrase.length < 12) throw new Error('Use a passphrase of at least 12 characters.');
  if (!crypto.subtle) throw new Error('Secure device storage needs HTTPS and a supported browser.');
  const savedAt = new Date().toISOString();
  // Explicit field selection keeps credentials and unrelated API fields out of the vault.
  const snapshot: OfflineJourney = {
    version: 1, savedAt,
    messages: data.messages.map(message => ({ id: message.id, role: message.role, content: message.content,
      ...(message.analysis ? { analysis: {
        reflection: message.analysis.reflection, clarification_question: message.analysis.clarification_question,
        next_action: message.analysis.next_action, avatar_state: message.analysis.avatar_state,
        demo_mode: message.analysis.demo_mode, concerns: [],
      } } : {}),
    })),
    concerns: data.concerns.map(({ id, title, category, urgency, deadline, confirmed }) => ({ id, title, category, urgency, deadline, confirmed })),
    actions: data.actions.map(({ id, title, status }) => ({ id, title, status })),
  };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(savedAt) }, key, new TextEncoder().encode(JSON.stringify(snapshot)));
  await entry('readwrite', { version: 1, savedAt, salt: salt.buffer, iv: iv.buffer, ciphertext });
}
export async function unlockOfflineCopy(passphrase: string): Promise<OfflineJourney> {
  if (!await offlineCopyDate()) throw new Error('No saved offline copy is available.');
  const saved = await entry('readonly');
  if (!saved) throw new Error('No saved offline copy is available.');
  try {
    const key = await deriveKey(passphrase, new Uint8Array(saved.salt));
    const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(saved.iv), additionalData: new TextEncoder().encode(saved.savedAt) }, key, saved.ciphertext);
    const data = JSON.parse(new TextDecoder().decode(bytes)) as OfflineJourney;
    if (data.version !== 1 || !Array.isArray(data.messages) || !Array.isArray(data.concerns) || !Array.isArray(data.actions)) throw new Error();
    return data;
  } catch { throw new Error('Could not unlock this copy. Check your passphrase, or delete it and save a new copy online.'); }
}
export async function deleteOfflineCopy(): Promise<void> { await entry('readwrite', null); }
