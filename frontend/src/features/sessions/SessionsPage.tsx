import {
  ArrowUpRight,
  ChevronRight,
  Compass,
  Pause,
  Play,
  Plus,
} from "lucide-react";
import { Badge, Button } from "../../components/ui";
import { api } from "../../lib/api";
import { date, fmt } from "../../lib/format";
import { go } from "../../lib/navigation";
import { Data, PageProps } from "../../lib/types";

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
      <div className="page-top">
        <span className="eyebrow">YOUR WORLDS</span>
        <span className="quiet">Everything stays on this machine.</span>
      </div>
      <div className="page-heading">
        <div>
          <h1>Leave a world in motion.</h1>
          <p>
            Gather a cast. Set the scene. Come back to a story that carried on.
          </p>
        </div>
        <Button primary onClick={newSession}>
          <Plus size={17} />
          New session
        </Button>
      </div>
      {boot.sessions.length === 0 ? (
        <div className="welcome">
          <div className="orbital">
            <Compass size={64} />
          </div>
          <span className="eyebrow">A PLACE TO BEGIN</span>
          <h2>Every world starts with a gathering.</h2>
          <p>
            Choose a setting and bring six distinct voices into it.
            <br />
            Their memories stay their own. Their conversation is shared.
          </p>
          <Button primary onClick={newSession}>
            Create your first session
            <ArrowUpRight size={16} />
          </Button>
        </div>
      ) : (
        <div className="session-grid">
          {boot.sessions.map((s: Data) => (
            <article className="session-card" key={s.id}>
              <div className="row between">
                <Badge value={s.status} />
                <span className="quiet">{date(s.updated)}</span>
              </div>
              <button
                className="card-link"
                onClick={() => {
                  localStorage.setItem("communion:lastSession", s.id);
                  go("/scene/" + s.id);
                }}
              >
                <h2>{s.name}</h2>
                <ArrowUpRight size={20} />
              </button>
              <p className="quiet">
                {s.character_count} characters · {fmt(s.message_count)} messages
              </p>
              <div className="card-footer">
                <Button onClick={() => go("/scene/" + s.id)}>
                  Open scene
                  <ChevronRight size={15} />
                </Button>
                <button
                  title={
                    s.status === "running" ? "Pause session" : "Resume session"
                  }
                  className="icon"
                  onClick={() =>
                    run(async () => {
                      await api(
                        `/sessions/${s.id}/${s.status === "running" ? "pause" : "start"}`,
                        "POST",
                      );
                      await refresh();
                    })
                  }
                >
                  {s.status === "running" ? (
                    <Pause size={17} />
                  ) : (
                    <Play size={17} />
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="section-heading">
        <div>
          <h2>Three starting points</h2>
          <p>Fresh worlds you can change into something entirely your own.</p>
        </div>
        <a href="#/scenarios">
          Explore scenarios
          <ArrowUpRight size={15} />
        </a>
      </div>
      <div className="world-grid">
        {boot.scenarios.slice(0, 3).map((s: Data, i: number) => (
          <article className="world-card" key={s.id}>
            <div className="world-number">
              0{i + 1}
              <span>
                {(
                  {
                    lantern: "VIGIL",
                    observatory: "DISCOVERY",
                    floodgate: "ENCOUNTER",
                  } as Record<string, string>
                )[s.id] || "WORLD"}
              </span>
            </div>
            <h3>{s.name}</h3>
            <p>{s.description}</p>
            <button
              onClick={() => {
                onSelectScenario(s.id);
              }}
            >
              Gather this cast
              <ArrowUpRight size={16} />
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
