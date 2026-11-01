import { ChevronRight, Plus } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { Button, Modal } from "../../components/ui";
import { tr } from "../../i18n";
import { Data } from "../../lib/types";
import { SceneModel } from "./useSceneController";

export function CastDialog({ model }: { model: SceneModel }) {
  const { scene, castOpen, setCastOpen, setEdit, newCharacter } = model;

  return (
    <>
      {castOpen && (
        <Modal
          title={tr("characters.peopleInThisScene")}
          onClose={() => setCastOpen(false)}
        >
          <Button
            onClick={() => {
              setCastOpen(false);
              newCharacter();
            }}
          >
            <Plus size={14} />
            {tr("scenarios.addCharacter")}
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
              <Avatar name={c.name} />
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
