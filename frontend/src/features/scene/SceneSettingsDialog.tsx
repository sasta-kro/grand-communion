import { Button, Field, Modal } from "../../components/ui";
import { tr } from "../../i18n";
import { api } from "../../lib/api";
import { SceneModel } from "./useSceneController";

export function SceneSettingsDialog({ model }: { model: SceneModel }) {
  const { id, fail, notify, sceneConfig, setSceneConfig, load } = model;

  return (
    <>
      {sceneConfig && (
        <Modal
          title={tr("scene.sceneSettings")}
          subtitle={tr("sceneSettings.changesApplyToThisWorldResumingAfterA")}
          onClose={() => setSceneConfig(null)}
        >
          <div className="form-grid">
            {[
              ["cooldown", tr("settings.characterCooldown")],
              ["global_gap", tr("settings.globalDeliveryGap")],
              ["word_limit", tr("settings.wordsPerPart")],
              ["max_parts", tr("settings.maximumSpeechParts")],
              ["working_context", tr("settings.workingContextCeiling")],
              ["narrator_interval", tr("settings.narratorInterval")],
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
          <Field label={tr("settings.compactionThreshold")}>
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
                  notify(tr("sceneSettings.globalDefaultsRestored"));
                } catch (e) {
                  fail(e);
                }
              }}
            >
              {tr("sceneSettings.useGlobalDefaults")}
            </Button>
            <Button
              primary
              onClick={async () => {
                try {
                  await api(`/sessions/${id}/config`, "PUT", sceneConfig);
                  setSceneConfig(null);
                  await load();
                  notify(tr("sceneSettings.sceneSettingsSaved"));
                } catch (e) {
                  fail(e);
                }
              }}
            >
              {tr("sceneSettings.saveForThisScene")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
