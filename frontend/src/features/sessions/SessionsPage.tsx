import { ArrowRight, Pause, Play, Plus } from "lucide-react";
import { Icon, type IconName } from "../../components/Icon";
import { Badge, Button, PageHeading } from "../../components/ui";
import { api } from "../../lib/api";
import { date, fmt } from "../../lib/format";
import { go } from "../../lib/navigation";
import type { PageProps } from "../../lib/types";

const scenarioIcons: Record<string, IconName> = {
  lantern: "lantern",
  observatory: "observatory",
  floodgate: "floodgate",
};

export function SessionsPage({
  boot,
  newSession,
  run,
  refresh,
  onSelectScenario,
}: PageProps & {
  newSession: () => void;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  onSelectScenario: (id: string) => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow=""
        title="Sessions"
        description="Open a conversation, or start one from a scenario."
        action={
          <Button primary onClick={newSession}>
            <Plus size={17} />
            New session
          </Button>
        }
      />
      {boot.sessions.length === 0 ? (
        <div className="welcome">
          <Icon name="chat" size={36} />
          <h2>No sessions yet</h2>
          <p>
            Create a session to choose its scenario and characters. New sessions
            start paused.
          </p>
          <Button primary onClick={newSession}>
            <Plus size={16} />
            Create session
          </Button>
        </div>
      ) : (
        <div className="session-grid">
          {boot.sessions.map((session) => (
            <article className="session-card" key={session.id}>
              <div className="session-summary">
                <Icon name="chat" size={26} />
                <div>
                  <button
                    className="card-link"
                    onClick={() => {
                      localStorage.setItem("communion:lastSession", session.id);
                      go("/scene/" + session.id);
                    }}
                  >
                    <h2>{session.name}</h2>
                  </button>
                  <p className="quiet">
                    {session.character_count} characters ·{" "}
                    {fmt(session.message_count)} messages
                  </p>
                  <time
                    className="quiet"
                    dateTime={new Date(session.updated * 1000).toISOString()}
                  >
                    Updated {date(session.updated)}
                  </time>
                </div>
              </div>
              <div className="card-footer">
                <Badge value={session.status} />
                <Button onClick={() => go("/scene/" + session.id)}>
                  Open chat
                  <ArrowRight size={15} />
                </Button>
                <button
                  title={
                    session.status === "running"
                      ? "Pause session"
                      : "Resume session"
                  }
                  className="icon"
                  onClick={() =>
                    run(async () => {
                      await api(
                        `/sessions/${session.id}/${session.status === "running" ? "pause" : "start"}`,
                        "POST",
                      );
                      await refresh();
                    })
                  }
                >
                  {session.status === "running" ? (
                    <Pause size={19} />
                  ) : (
                    <Play size={19} />
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="section-heading">
        <div>
          <h2>Scenarios</h2>
          <p>Start a separate session with these characters and settings.</p>
        </div>
        <a href="#/scenarios">
          View all
          <ArrowRight size={15} />
        </a>
      </div>
      <div className="world-grid">
        {boot.scenarios.slice(0, 3).map((scenario) => (
          <article className="world-card" key={scenario.id}>
            <div className="scenario-icon">
              <Icon
                name={scenarioIcons[scenario.id] || "scenarios"}
                size={28}
              />
              <span>{scenario.cast.length} characters</span>
            </div>
            <h3>{scenario.name}</h3>
            <p>{scenario.description}</p>
            <button onClick={() => onSelectScenario(scenario.id)}>
              Use scenario
              <ArrowRight size={16} />
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
