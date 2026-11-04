/** Mutable field-driven editor drafts and provider-specific diagnostic payloads. */
export type Data = Record<string, any>;

export interface Persona {
  archived?: boolean;
  id: string;
  name: string;
  prompt: string;
}
export interface Provider extends Data {
  id: string;
  name: string;
  model: string;
  configured: boolean;
}
export interface CastMember {
  persona?: string | null;
  name: string;
  persona_id: string;
  role: string;
  background: string;
  provider_id: string;
  cooldown: number | null;
  muted: boolean;
}
export interface Character extends CastMember {
  id: string;
  persona: string;
  memory: string;
  phase: string;
  memory_cutoff: number;
  observed: number;
  memory_checkpoints: number;
}
export interface Scenario {
  id: string;
  name: string;
  description: string;
  premise: string;
  ambient_voices: string[];
  cast: CastMember[];
}
export interface SessionSummary {
  archived?: boolean;
  id: string;
  name: string;
  status: string;
  updated: number;
  character_count: number;
  message_count: number;
}
export interface ReplyExcerpt {
  id: number;
  name: string;
  text: string;
  truncated?: boolean;
}
export interface BoardMessage {
  id: number;
  author_id: string | null;
  name: string;
  text: string;
  at: number;
  addressees: string[];
  reply_to: number | null;
  reply_preview?: ReplyExcerpt | null;
  request_id: string;
  part: number;
  parts: number;
}
export interface RequestRecord {
  id: string;
  character_id: string;
  kind: string;
  status: string;
  cutoff: number;
  created: number;
  updated: number;
  error: string;
  reasoning: string;
  metrics: Data;
}
export interface LogRecord {
  id: number;
  level: string;
  message: string;
  character_id: string;
  request_id: string;
  at: number;
}
export interface RecapRecord {
  current_policy?: boolean;
  id: string;
  created: number;
  after_id: number;
  cutoff: number;
  scope: string;
  body: {
    title: string;
    narrative: string;
    notable: { text: string; message_ids: number[] }[];
    unresolved: string[];
  };
}
export interface SceneData {
  archived?: boolean;
  metadata?: { forked_from?: string; forked_at?: number; warnings?: string[] };
  id: string;
  name: string;
  status: string;
  scenario: Scenario;
  characters: Character[];
  messages: BoardMessage[];
  settings: Data;
  config: Data;
  cutoff: number;
  event_cursor: number;
}
export interface BootstrapData {
  sessions: SessionSummary[];
  scenarios: Scenario[];
  personas: Persona[];
  providers: Provider[];
  settings: Data;
}
export interface PageProps {
  boot: BootstrapData;
  refresh: () => Promise<void>;
  fail: (error: unknown) => void;
  notify: (message: string) => void;
}
export interface ScenePageProps extends PageProps {
  id: string;
}
