import { Compass } from "lucide-react";
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
import { SceneModel, useSceneController } from "./useSceneController";

export function Scene(props: ScenePageProps) {
  const controller = useSceneController(props);
  if (!controller.scene)
    return (
      <div className="loading">
        <Compass size={30} />
        <p>Opening scene...</p>
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
    </div>
  );
}
