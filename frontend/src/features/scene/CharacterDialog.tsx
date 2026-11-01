import { Button, Field, Modal } from "../../components/ui";
import { api } from "../../lib/api";
import { Data } from "../../lib/types";
import { SceneModel } from "./useSceneController";

export function CharacterDialog({ model }: { model: SceneModel }) {
  const { id, boot, fail, notify, scene, edit, setEdit, load } = model;

  return (
    <>
      {" "}
      {edit && (
        <Modal
          title={edit.id === "new" ? "A new person enters" : edit.name}
          subtitle="Identity, private background, and first-person memory."
          onClose={() => setEdit(null)}
          wide
        >
          <div className="form-grid">
            <Field label="Name">
              <input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </Field>
            <Field label="Public role">
              <input
                value={edit.role}
                onChange={(e) => setEdit({ ...edit, role: e.target.value })}
              />
            </Field>
            <Field label="Provider">
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
              label="Cooldown in seconds"
              hint="Blank uses the session default."
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
          <Field label="Copy a reusable persona">
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
              <option value="">Custom personality</option>
              {boot.personas.map((p: Data) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Personality, in this character's own words">
            <textarea
              rows={4}
              value={edit.persona}
              onChange={(e) => setEdit({ ...edit, persona: e.target.value })}
            />
          </Field>
          <Field label="Private background">
            <textarea
              rows={3}
              value={edit.background}
              onChange={(e) => setEdit({ ...edit, background: e.target.value })}
            />
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={edit.muted || false}
              onChange={(e) => setEdit({ ...edit, muted: e.target.checked })}
            />
            Keep this character quiet. Regular observation continues.
          </label>
          <div className="memory-box">
            <h3>My recollections</h3>
            <p>
              {edit.memory ||
                "No compacted memory yet. Recent observations remain in the context tail."}
            </p>
            <small>
              {edit.memory_checkpoints} checkpoints · observed through #
              {edit.observed} · memory covers through #{edit.memory_cutoff}
            </small>
          </div>
          <div className="actions">
            <Button
              disabled={scene.status === "running" || edit.id === "new"}
              title="Pause before manually compacting"
              onClick={async () => {
                try {
                  await api(
                    `/sessions/${id}/characters/${edit.id}/compact`,
                    "POST",
                  );
                  await load();
                  notify("Memory checkpoint saved");
                  setEdit(null);
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Compact now
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
                  notify("Character updated");
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Save character
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
