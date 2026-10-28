export type Urgency = 'high' | 'medium' | 'low' | 'unknown' | 'ongoing';
export interface Concern {
  id: number;
  title: string;
  category: string;
  urgency: Urgency;
  deadline: string | null;
  confirmed: boolean;
}
export interface Analysis {
  reflection: string;
  clarification_question: string | null;
  concerns: { title: string; category: string; urgency: Urgency; deadline: string | null }[];
  next_action: string | null;
  avatar_state: string;
  demo_mode?: boolean;
}
export interface JourneyAction {
  id: number;
  title: string;
  status: 'pending' | 'completed' | 'partly_done' | 'not_started';
}
export interface Message {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  analysis?: Analysis;
}
export interface GuestAccess { journey_id: string; access_token: string }
export interface JourneySnapshot {
  journey: { id: string; phase: string };
  messages: Message[];
  concerns: Concern[];
  actions: JourneyAction[];
}
export interface RequestTimings { requestMs: number; metaMs?: number; validationMs?: number; backendMs?: number }
export interface MessageResponse { phase: string; analysis: Analysis; concerns: Concern[]; timings?: RequestTimings }
export type ConcernEdit = Pick<Concern, 'title' | 'category' | 'urgency' | 'deadline' | 'confirmed'>;
