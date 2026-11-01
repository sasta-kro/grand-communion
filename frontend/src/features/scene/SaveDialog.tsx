import { Download, Save, Upload } from "lucide-react";
import { Button, Modal } from "../../components/ui";
import { tr } from "../../i18n";
import { api } from "../../lib/api";
import { date } from "../../lib/format";
import { go } from "../../lib/navigation";
import { SceneModel } from "./useSceneController";

export function SaveDialog({ model }: { model: SceneModel }) {
  const {
    id,
    refresh,
    fail,
    notify,
    saveOpen,
    setSaveOpen,
    saves,
    setSaves,
    saveName,
    setSaveName,
  } = model;

  return (
    <>
      {saveOpen && (
        <Modal
          title={tr("saves.sessionSaves")}
          subtitle={tr(
            "saves.historyCharacterMemoriesAndSettingsCredentialsStayOn",
          )}
          onClose={() => setSaveOpen(false)}
        >
          <div className="inline">
            <input
              aria-label={tr("saves.checkpointName")}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
            <Button
              primary
              onClick={async () => {
                try {
                  await api(`/sessions/${id}/saves`, "POST", {
                    name: saveName,
                  });
                  setSaves(await api(`/sessions/${id}/saves`));
                  notify(tr("saves.checkpointSaved"));
                } catch (e) {
                  fail(e);
                }
              }}
            >
              <Save size={16} />
              {tr("common.save")}
            </Button>
          </div>
          <div className="info-box">
            {tr("saves.loadingACheckpointOpensARestoredCopyPaused")}
          </div>
          {saves.map((s) => (
            <div className="save-row" key={s.id}>
              <span>
                <strong>{s.name}</strong>
                <small>{date(s.created)}</small>
              </span>
              <a
                href={"/api/saves/" + s.id}
                download
                className="icon"
                title={tr("saves.downloadSave")}
              >
                <Download size={17} />
              </a>
              <Button
                onClick={async () => {
                  try {
                    const result = await api(`/saves/${s.id}/load`, "POST");
                    setSaveOpen(false);
                    await refresh();
                    go("/scene/" + result.id);
                  } catch (e) {
                    fail(e);
                  }
                }}
              >
                {tr("saves.load")}
              </Button>
            </div>
          ))}
          <label className="button import-button">
            <Upload size={16} />
            {tr("saves.importASavedWorld")}
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const result = await api(
                    "/saves/import",
                    "POST",
                    JSON.parse(await f.text()),
                  );
                  setSaveOpen(false);
                  await refresh();
                  go("/scene/" + result.id);
                } catch (error) {
                  fail(error);
                }
              }}
            />
          </label>
        </Modal>
      )}
    </>
  );
}
