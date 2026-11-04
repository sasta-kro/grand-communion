import { Compass } from "lucide-react";
import { Button } from "../../components/ui";
import { tr } from "../../i18n";
import { go } from "../../lib/navigation";
import { ScenePageProps } from "../../lib/types";
import { CastDialog } from "./CastDialog";
import { CharacterDialog } from "./CharacterDialog";
import { CharacterRoster } from "./CharacterRoster";
import { Conversation } from "./Conversation";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { RecapDialog } from "./RecapDialog";
import { SaveDialog } from "./SaveDialog";
import { SceneHeader } from "./SceneHeader";
import { SceneSettingsDialog } from "./SceneSettingsDialog";
import { ForkDialog } from "./ForkDialog";
import { SceneModel, useSceneController } from "./useSceneController";

export function Scene(props: ScenePageProps) {
  const controller = useSceneController(props);
  if (!controller.scene && controller.loadError)
    return (
      <div className="empty-state" role="alert">
        <h1>{tr("scene.cannotOpenThisSession")}</h1>
        <p>{controller.loadError}</p>
        <div className="row">
          <Button onClick={controller.load}>{tr("common.retry")}</Button>
          <Button onClick={() => go("/sessions")}>
            {tr("app.goToSessions")}
          </Button>
        </div>
      </div>
    );
  if (!controller.scene)
    return (
      <div className="loading">
        <Compass size={30} />
        <p>{tr("scene.openingScene")}</p>
      </div>
    );
  const model: SceneModel = { ...controller, scene: controller.scene };
  const { diagnostics } = model;
  return (
    <div className="scene-shell">
      <SceneHeader model={model} />{" "}
      <div className={`scene-layout ${diagnostics ? "with-diagnostics" : ""}`}>
        <CharacterRoster model={model} />
        <Conversation model={model} />
        <DiagnosticsPanel model={model} />{" "}
      </div>
      <SceneSettingsDialog model={model} />
      <CastDialog model={model} />
      <CharacterDialog model={model} />
      <RecapDialog model={model} />
      <SaveDialog model={model} />
      {model.forkPoint !== undefined && <ForkDialog model={model} />}
    </div>
  );
}
