import type { SessionSummary } from "./types";

/** A paused last-viewed scene must not make the Chat tab a silent no-op. */
export function chatDestination(sessions: SessionSummary[]): string {
  const running = sessions.filter((session) => session.status === "running");
  return running.length === 1 ? `#/scene/${running[0].id}` : "#/chat";
}
