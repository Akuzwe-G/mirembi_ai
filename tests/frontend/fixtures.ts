import type { Analysis, Concern, GuestAccess, JourneySnapshot } from '../../resources/js/types';

export const access: GuestAccess = { journey_id: '12345678-1234-1234-1234-123456789abc', access_token: 'a'.repeat(64) };
export const concern: Concern = { id: 1, title: 'Coursework', category: 'education', urgency: 'high', deadline: 'Friday', confirmed: false };
export const analysis: Analysis = { reflection: 'There are two things competing for your attention.', clarification_question: 'Which deadline comes first?', concerns: [concern], next_action: 'Write down the nearest deadline.', avatar_state: 'listening' };
export const snapshot: JourneySnapshot = { journey: { id: access.journey_id, phase: 'clarify' }, messages: [
  { id: 1, role: 'user', content: 'I have an assignment due.' }, { id: 2, role: 'assistant', content: analysis.reflection },
], concerns: [concern], actions: [] };
