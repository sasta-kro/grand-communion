import { Play, Plus } from "lucide-react";
import { Icon } from "../../components/Icon";
import { Badge, Button, PageHeading } from "../../components/ui";
import { tr } from "../../i18n";
import { api } from "../../lib/api";
import { go } from "../../lib/navigation";
import type { PageProps } from "../../lib/types";

export function ChatPage({
  boot,
  refresh,
  fail,
  newSession,
}: PageProps & { newSession: () => void }) {
  const running = boot.sessions.filter(
    (session) => session.status === "running",
  );
  return (
    <div className="page">
      <PageHeading
        eyebrow=""
        title={tr("navigation.chat")}
        description={tr("chat.chooseARunningConversationOrOpenAPaused")}
        action={
          <Button primary onClick={newSession}>
            <Plus size={16} />
            {tr("sessions.newSession")}
          </Button>
        }
      />
      {!running.length && (
        <div className="empty-state" role="status">
          <Icon name="chat" size={32} />
          <h2>{tr("navigation.noSessionsRunning")}</h2>
          <p>{tr("chat.createASessionOrResumeOneBelowTo")}</p>
          {!boot.sessions.length && (
            <Button onClick={newSession}>{tr("chat.createASession")}</Button>
          )}
        </div>
      )}
      {boot.sessions.length > 0 && (
        <div className="session-grid">
          {[
            ...running,
            ...boot.sessions.filter((session) => session.status !== "running"),
          ].map((session) => (
            <article className="session-card" key={session.id}>
              <div>
                <h2>{session.name}</h2>
                <Badge value={session.status} />
              </div>
              <div className="card-footer">
                <Button onClick={() => go("/scene/" + session.id)}>
                  {session.status === "running"
                    ? tr("sessions.openChat")
                    : tr("chat.openHistory")}
                </Button>
                {session.status !== "running" && (
                  <Button
                    onClick={async () => {
                      try {
                        await api(`/sessions/${session.id}/start`, "POST");
                        await refresh();
                        go("/scene/" + session.id);
                      } catch (error) {
                        fail(error);
                      }
                    }}
                  >
                    <Play size={15} />
                    {tr("common.resume")}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
