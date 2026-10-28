import type { GuestAccess, JourneySnapshot, MessageResponse, Concern, ConcernEdit, JourneyAction } from './types';
import type { VoiceLanguage } from './voice/languages';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, access?: GuestAccess, method = 'GET', data?: unknown, timed = false): Promise<T> {
  const started = performance.now();
  let response: Response;
  try {
    response = await fetch(`/api/journeys${path}`, {
      method, cache: 'no-store', credentials: 'omit',
      headers: {
        Accept: 'application/json',
        ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(access ? { Authorization: `Bearer ${access.access_token}` } : {}),
      },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
  } catch {
    throw new ApiError(0, 'We could not confirm the request. Check your connection and refresh this journey before sending again.');
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      403: 'This guest journey is no longer accessible in this tab.',
      404: 'This journey could not be found. It may have been cleared.',
      422: 'Please check your entries and try again.',
      429: 'Let’s pause for a moment. Please try again in a minute.',
      503: 'Mirembe couldn’t reflect on that just now. Your journey is unchanged. You can try sending again.',
    };
    throw new ApiError(response.status, messages[response.status] ?? 'Something went wrong. Please refresh your journey and try again.');
  }
  if (response.status === 204) return undefined as T;
  try {
    const result = await response.json();
    if (timed) {
      const metric = (name: string) => {
        const match = response.headers.get('Server-Timing')?.match(new RegExp(`(?:^|, )${name};dur=([0-9.]+)`));
        return match && Number.isFinite(Number(match[1])) ? Number(match[1]) : undefined;
      };
      result.timings = { requestMs: performance.now() - started, metaMs: metric('meta'), validationMs: metric('validation'), backendMs: metric('backend') };
    }
    return result as T;
  }
  catch { throw new ApiError(0, 'We could not read the response. Refresh your journey before trying again.'); }
}

const path = (access: GuestAccess) => `/${encodeURIComponent(access.journey_id)}`;
export const api = {
  create: () => request<GuestAccess & { phase: string }>('', undefined, 'POST'),
  restore: (access: GuestAccess) => request<JourneySnapshot>(path(access), access),
  send: (access: GuestAccess, message: string, language: VoiceLanguage = 'en-US') => request<MessageResponse>(`${path(access)}/messages`, access, 'POST', { message, language, language_source: 'user_selected' }, true),
  edit: (access: GuestAccess, id: number, edit: ConcernEdit) => request<Concern>(`${path(access)}/concerns/${id}`, access, 'PATCH', edit),
  confirm: (access: GuestAccess, id: number) => request<{ phase: string; concerns: Concern[] }>(`${path(access)}/confirm`, access, 'POST', { concern_ids: [id] }),
  action: (access: GuestAccess, title: string) => request<JourneyAction>(`${path(access)}/actions`, access, 'POST', { title }),
  complete: (access: GuestAccess, id: number, status: JourneyAction['status']) => request<JourneyAction>(`${path(access)}/actions/${id}`, access, 'PATCH', { status }),
  clear: (access: GuestAccess) => request<void>(path(access), access, 'DELETE'),
};
