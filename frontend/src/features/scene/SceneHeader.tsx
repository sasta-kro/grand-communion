import { ArrowLeft, Pause, Play } from "lucide-react";
import { Icon } from "../../components/Icon";
import { Badge, Button } from "../../components/ui";
import { tr } from "../../i18n";
import { api } from "../../lib/api";
import { fmt } from "../../lib/format";
import { SceneModel } from "./useSceneController";

export function SceneHeader({ model }: { model: SceneModel }) {
  const {
    id,
    scene,
    diagnostics,
    setDiagnostics,
    setCastOpen,
    setSceneConfig,
    setRecapOpen,
    setSaveOpen,
    setSaves,
    action,
  } = model;

  return (
    <>
      <header className="scene-header">
        <div>
          <a href="#/sessions" className="back">
            <ArrowLeft size={13} />
            {tr("navigation.sessions")}
          </a>
          <h1>{scene.name}</h1>
          <div className="row">
            <Badge value={scene.status} />
            <span className="quiet">
              {tr("scene.charactersLoadedMessages", {
                length: scene.characters.length,
                count: fmt(scene.cutoff ? scene.messages.length : 0),
              })}
            </span>
          </div>
        </div>
        <div className="scene-actions">
          <Button
            title={tr("scene.sceneSettings")}
            onClick={() => setSceneConfig({ ...scene.settings })}
          >
            <Icon name="controls" size={18} />
            <span>{tr("navigation.settings")}</span>
          </Button>
          <Button className="mobile-cast" onClick={() => setCastOpen(true)}>
            <Icon name="cast" size={18} />
            <span>{tr("scene.cast")}</span>
          </Button>
          <Button onClick={() => setRecapOpen(true)}>
            <Icon name="recap" size={18} />
            <span>{tr("scene.recap")}</span>
          </Button>
          <Button
            onClick={async () => {
              setSaves(await api(`/sessions/${id}/saves`));
              setSaveOpen(true);
            }}
          >
            <Icon name="save" size={18} />
            <span>{tr("common.save")}</span>
          </Button>
          <Button
            className={diagnostics ? "active" : ""}
            onClick={() => setDiagnostics(!diagnostics)}
          >
            <Icon name="diagnostics" size={18} />
            <span>{tr("diagnostics.diagnostics")}</span>
          </Button>
          <Button
            primary
            onClick={() =>
              action(scene.status === "running" ? "pause" : "start")
            }
          >
            {scene.status === "running" ? (
              <Pause size={16} />
            ) : (
              <Play size={16} />
            )}
            <span>
              {scene.status === "running"
                ? tr("common.pause")
                : tr("common.resume")}
            </span>
          </Button>
        </div>
      </header>
    </>
  );
}
