import { ChevronRight, Eye, Plus } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { tr } from "../../i18n";
import { requestStatusLabel } from "../../lib/requestStatus";
import { Data } from "../../lib/types";
import { SceneModel } from "./useSceneController";

export function CharacterRoster({ model }: { model: SceneModel }) {
  const { scene, requests, setEdit, newCharacter, active } = model;

  return (
    <>
      <aside className="roster">
        <div className="row between">
          <h3>{tr("characters.characters")}</h3>
          <button
            className="icon"
            title={tr("scenarios.addCharacter")}
            onClick={newCharacter}
          >
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
              <Avatar name={c.name} />
              <span>
                <strong>{c.name}</strong>
                <small>{c.role}</small>
                <em className={phase === "error" ? "error-text" : ""}>
                  {c.muted
                    ? tr("characters.quietStillListening")
                    : phase === "cooldown"
                      ? tr("characters.listening")
                      : requestStatusLabel(phase)}
                </em>
              </span>
              <ChevronRight size={13} />
            </button>
          );
        })}
        <div className="roster-note">
          <Eye size={15} />
          <p>{tr("characters.youObserveFromOutsideTheWorldTheCharacters")}</p>
        </div>
        <div className="scene-premise">
          <span className="eyebrow">{tr("characters.setting")}</span>
          <p>{scene.scenario.premise}</p>
        </div>
      </aside>
    </>
  );
}
