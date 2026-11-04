import { Button, Checkbox, Field, Modal } from "../../components/ui";
import { tr } from "../../i18n";
import { api } from "../../lib/api";
import { Data } from "../../lib/types";
import { SceneModel } from "./useSceneController";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

export function CharacterDialog({ model }: { model: SceneModel }) {
  const { id, boot, fail, notify, scene, edit, setEdit, load } = model;
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setRemoving(false);
    setRemoveError("");
  }, [edit?.id]);

  if (removing && edit)
    return (
      <Modal
        title={tr("lifecycle.removeCharacter", { name: edit.name })}
        onClose={() => {
          if (!busy) setRemoving(false);
        }}
      >
        <p>{tr("lifecycle.removeCharacterDescription")}</p>
        {removeError && (
          <p className="alert" role="alert">
            {removeError}
          </p>
        )}
        <div className="actions">
          <Button disabled={busy} onClick={() => setRemoving(false)}>
            {tr("common.cancel")}
          </Button>
          <Button
            disabled={busy}
            className="danger"
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/sessions/${id}/characters/${edit.id}`, "DELETE");
                setEdit(null);
                setRemoving(false);
                await load();
                await model.refresh();
              } catch (error) {
                setRemoveError(String(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 size={16} />
            {tr("lifecycle.remove")}
          </Button>
        </div>
      </Modal>
    );

  return (
    <>
      {edit && (
        <Modal
          title={edit.id === "new" ? tr("scenarios.addCharacter") : edit.name}
          subtitle={tr(
            "characters.identityPrivateBackgroundAndFirstPersonMemory",
          )}
          onClose={() => setEdit(null)}
          wide
        >
          <div className="form-grid">
            <Field label={tr("common.name")}>
              <input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </Field>
            <Field label={tr("scenarios.publicRole")}>
              <input
                value={edit.role}
                onChange={(e) => setEdit({ ...edit, role: e.target.value })}
              />
            </Field>
            <Field label={tr("scenarios.provider")}>
              <select
                value={edit.provider_id}
                onChange={(e) =>
                  setEdit({ ...edit, provider_id: e.target.value })
                }
              >
                {boot.providers.map((p: Data) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={tr("characters.cooldownInSeconds")}
              hint={tr("characters.blankUsesTheSessionDefault")}
            >
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={edit.cooldown ?? ""}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    cooldown: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </Field>
          </div>
          <Field label={tr("characters.copyAReusablePersona")}>
            <select
              value={edit.persona_id}
              onChange={(e) =>
                setEdit({
                  ...edit,
                  persona_id: e.target.value,
                  persona:
                    boot.personas.find((p: Data) => p.id === e.target.value)
                      ?.prompt || edit.persona,
                })
              }
            >
              <option value="">{tr("characters.customPersonality")}</option>
              {boot.personas.map((p: Data) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr("characters.personalityInThisCharacterSOwnWords")}>
            <textarea
              rows={4}
              value={edit.persona}
              onChange={(e) => setEdit({ ...edit, persona: e.target.value })}
            />
          </Field>
          <Field label={tr("scenarios.privateBackground")}>
            <textarea
              rows={3}
              value={edit.background}
              onChange={(e) => setEdit({ ...edit, background: e.target.value })}
            />
          </Field>
          <Checkbox
            checked={edit.muted || false}
            onChange={(e) => setEdit({ ...edit, muted: e.target.checked })}
            label={tr(
              "characters.keepThisCharacterQuietRegularObservationContinues",
            )}
          />
          <div className="memory-box">
            <h3>{tr("characters.characterMemory")}</h3>
            <p>
              {edit.memory ||
                tr("characters.noCompactedMemoryYetRecentObservationsRemainIn")}
            </p>
            <small>
              {tr("characters.checkpointsObservedThroughMemoryCoversThrough", {
                memorycheckpoints: edit.memory_checkpoints,
                observed: edit.observed,
                memorycutoff: edit.memory_cutoff,
              })}
            </small>
          </div>
          <div className="actions">
            {edit.id !== "new" && (
              <Button className="danger" onClick={() => setRemoving(true)}>
                <Trash2 size={15} />
                {tr("lifecycle.remove")}
              </Button>
            )}
            <Button
              disabled={scene.status === "running" || edit.id === "new"}
              title={tr("characters.pauseBeforeManuallyCompacting")}
              onClick={async () => {
                try {
                  await api(
                    `/sessions/${id}/characters/${edit.id}/compact`,
                    "POST",
                  );
                  await load();
                  notify(tr("characters.memoryCheckpointSaved"));
                  setEdit(null);
                } catch (e) {
                  fail(e);
                }
              }}
            >
              {tr("characters.compactNow")}
            </Button>
            <Button
              primary
              disabled={!edit.name}
              onClick={async () => {
                try {
                  await api(
                    `/sessions/${id}/characters${edit.id === "new" ? "" : "/" + edit.id}`,
                    edit.id === "new" ? "POST" : "PUT",
                    edit,
                  );
                  setEdit(null);
                  await load();
                  notify(tr("characters.characterUpdated"));
                } catch (e) {
                  fail(e);
                }
              }}
            >
              {tr("characters.saveCharacter")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
