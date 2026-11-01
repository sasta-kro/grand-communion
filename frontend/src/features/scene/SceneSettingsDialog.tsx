import { Button, Field, Modal } from "../../components/ui";
import { api } from "../../lib/api";
import { SceneModel } from "./useSceneController";

export function SceneSettingsDialog({ model }: { model: SceneModel }) {
  const { id, fail, notify, sceneConfig, setSceneConfig, load } = model;

  return (
    <>
      {" "}
      {sceneConfig && (
        <Modal
          title="Scene settings"
          subtitle="Changes apply to this world. Resuming after a save preserves these values."
          onClose={() => setSceneConfig(null)}
        >
          <div className="form-grid">
            {[
              ["cooldown", "Character cooldown"],
              ["global_gap", "Global delivery gap"],
              ["word_limit", "Words per part"],
              ["max_parts", "Maximum speech parts"],
              ["working_context", "Working context ceiling"],
              ["narrator_interval", "Narrator interval"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type="number"
                  step={
                    key === "cooldown" || key === "global_gap" ? "0.5" : "1"
                  }
                  value={sceneConfig[key]}
                  onChange={(e) =>
                    setSceneConfig({
                      ...sceneConfig,
                      [key]: Number(e.target.value),
                    })
                  }
                />
              </Field>
            ))}
          </div>
          <Field label="Compaction threshold (%)">
            <input
              type="number"
              min="15"
              max="95"
              value={Math.round(sceneConfig.compact_ratio * 100)}
              onChange={(e) =>
                setSceneConfig({
                  ...sceneConfig,
                  compact_ratio: Number(e.target.value) / 100,
                })
              }
            />
          </Field>
          <div className="actions">
            <Button
              onClick={async () => {
                try {
                  await api(`/sessions/${id}/config`, "PUT", {});
                  setSceneConfig(null);
                  await load();
                  notify("Global defaults restored");
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Use global defaults
            </Button>
            <Button
              primary
              onClick={async () => {
                try {
                  await api(`/sessions/${id}/config`, "PUT", sceneConfig);
                  setSceneConfig(null);
                  await load();
                  notify("Scene settings saved");
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Save for this scene
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
