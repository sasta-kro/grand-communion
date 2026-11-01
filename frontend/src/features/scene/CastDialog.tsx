import { ChevronRight, Plus } from "lucide-react";
import { Button, Modal } from "../../components/ui";
import { color, initials } from "../../lib/format";
import { Data } from "../../lib/types";
import { SceneModel } from "./useSceneController";

export function CastDialog({ model }: { model: SceneModel }) {
  const { scene, castOpen, setCastOpen, setEdit, newCharacter } = model;

  return (
    <>
      {" "}
      {castOpen && (
        <Modal title="People in this scene" onClose={() => setCastOpen(false)}>
          <Button
            onClick={() => {
              setCastOpen(false);
              newCharacter();
            }}
          >
            <Plus size={14} />
            Add character
          </Button>
          {scene.characters.map((c: Data) => (
            <button
              className="character-row"
              key={c.id}
              onClick={() => {
                setCastOpen(false);
                setEdit({ ...c });
              }}
            >
              <span className={"avatar " + color(c.name)}>
                {initials(c.name)}
              </span>
              <span>
                <strong>{c.name}</strong>
                <small>{c.role}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </Modal>
      )}
    </>
  );
}
