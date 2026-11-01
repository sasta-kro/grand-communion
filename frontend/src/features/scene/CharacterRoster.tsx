import { ChevronRight, Eye, Plus } from "lucide-react";
import { color, initials } from "../../lib/format";
import { Data } from "../../lib/types";
import { SceneModel } from "./useSceneController";

export function CharacterRoster({ model }: { model: SceneModel }) {
  const { scene, requests, setEdit, newCharacter, active } = model;

  return (
    <>
      {" "}
      <aside className="roster">
        <div className="row between">
          <h3>In this scene</h3>
          <button className="icon" title="Add character" onClick={newCharacter}>
            <Plus size={14} />
          </button>
        </div>
        {scene.characters.map((c: Data) => {
          const latest = requests.find(
            (r) => r.character_id === c.id && r.kind === "character",
          );
          const phase =
            latest && active.includes(latest) ? latest.status : c.phase;
          return (
            <button
              className="character-row"
              key={c.id}
              onClick={() => setEdit({ ...c })}
            >
              <span className={"avatar " + color(c.name)}>
                {initials(c.name)}
              </span>
              <span>
                <strong>{c.name}</strong>
                <small>{c.role}</small>
                <em className={phase === "error" ? "error-text" : ""}>
                  {c.muted
                    ? "Quiet · still listening"
                    : phase === "cooldown"
                      ? "Listening"
                      : phase}
                </em>
              </span>
              <ChevronRight size={13} />
            </button>
          );
        })}
        <div className="roster-note">
          <Eye size={15} />
          <p>
            You observe from outside the world. The characters hear only what
            you choose to say within it.
          </p>
        </div>
        <div className="scene-premise">
          <span className="eyebrow">THE SETTING</span>
          <p>{scene.scenario.premise}</p>
        </div>
      </aside>
    </>
  );
}
