import {
  Activity,
  ArrowLeft,
  BookOpen,
  Pause,
  Play,
  Save,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Badge, Button } from "../../components/ui";
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
      {" "}
      <header className="scene-header">
        <div>
          <a href="#/sessions" className="back">
            <ArrowLeft size={13} />
            Sessions
          </a>
          <h1>{scene.name}</h1>
          <div className="row">
            <Badge value={scene.status} />
            <span className="quiet">
              {scene.characters.length} voices ·{" "}
              {fmt(scene.cutoff ? scene.messages.length : 0)} loaded messages
            </span>
          </div>
        </div>
        <div className="scene-actions">
          <Button
            title="Scene settings"
            onClick={() => setSceneConfig({ ...scene.settings })}
          >
            <SlidersHorizontal size={16} />
            <span>Settings</span>
          </Button>
          <Button className="mobile-cast" onClick={() => setCastOpen(true)}>
            <Users size={16} />
            <span>Cast</span>
          </Button>
          <Button onClick={() => setRecapOpen(true)}>
            <BookOpen size={16} />
            <span>Recap</span>
          </Button>
          <Button
            onClick={async () => {
              setSaves(await api(`/sessions/${id}/saves`));
              setSaveOpen(true);
            }}
          >
            <Save size={16} />
            <span>Save</span>
          </Button>
          <Button
            className={diagnostics ? "active" : ""}
            onClick={() => {
              setDiagnostics(!diagnostics);
              localStorage.setItem(
                "communion:diagnostics",
                String(!diagnostics),
              );
            }}
          >
            <Activity size={16} />
            <span>Diagnostics</span>
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
            <span>{scene.status === "running" ? "Pause" : "Resume"}</span>
          </Button>
        </div>
      </header>
    </>
  );
}
