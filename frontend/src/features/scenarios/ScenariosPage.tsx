import { ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Field, Modal, PageHeading } from "../../components/ui";
import { tr } from "../../i18n";
import { api } from "../../lib/api";
import { color, initials } from "../../lib/format";
import { Data, PageProps } from "../../lib/types";

export function Scenarios({
  boot,
  refresh,
  fail,
  notify,
  onCreateSession,
}: PageProps & { onCreateSession: (id: string) => void }) {
  const [edit, setEdit] = useState<Data | null>(null);
  const updateCast = (i: number, key: string, value: any) =>
    setEdit((s: Data | null) =>
      s
        ? {
            ...s,
            cast: s.cast.map((c: Data, j: number) =>
              j === i ? { ...c, [key]: value } : c,
            ),
          }
        : s,
    );
  return (
    <div className="page">
      <PageHeading
        eyebrow=""
        title={tr("navigation.scenarios")}
        description={tr("scenarios.editTheSettingCharactersAndActivityUsedTo")}
        action={
          <Button
            primary
            onClick={() =>
              setEdit({
                id: crypto.randomUUID(),
                name: "",
                description: "",
                premise: "",
                ambient_voices: ["Bystander", "Anonymous voice"],
                cast: [],
              })
            }
          >
            <Plus size={17} />
            {tr("scenarios.newScenario")}
          </Button>
        }
      />
      <div className="entity-grid">
        {boot.scenarios.map((s: Data) => (
          <article className="entity-card scenario-card" key={s.id}>
            <span className="eyebrow">
              {tr("scenarios.characters", { length: s.cast.length })}
            </span>
            <h2>{s.name}</h2>
            <p>{s.description}</p>
            <div className="mini-cast">
              {s.cast.map((c: Data) => (
                <span
                  key={c.name}
                  className={"avatar " + color(c.name)}
                  title={c.name}
                >
                  {initials(c.name)}
                </span>
              ))}
            </div>
            <div className="row">
              <Button onClick={() => setEdit(structuredClone(s))}>
                {tr("scenarios.editSetting")}
              </Button>
              <Button primary onClick={() => onCreateSession(s.id)}>
                {tr("scenarios.startHere")}
                <ArrowUpRight size={15} />
              </Button>
            </div>
          </article>
        ))}
      </div>
      {edit && (
        <Modal
          title={tr("scenarios.editScenario")}
          subtitle={tr(
            "scenarios.everyCharacterReceivesTheSharedSettingAndOnly",
          )}
          wide
          onClose={() => setEdit(null)}
        >
          <Field label={tr("common.name")}>
            <input
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
          </Field>
          <Field label={tr("scenarios.shortDescription")}>
            <input
              value={edit.description}
              onChange={(e) =>
                setEdit({ ...edit, description: e.target.value })
              }
            />
          </Field>
          <Field label={tr("scenarios.sharedOpeningPremise")}>
            <textarea
              rows={5}
              value={edit.premise}
              onChange={(e) => setEdit({ ...edit, premise: e.target.value })}
            />
          </Field>
          <Field
            label={tr("scenarios.ambientVoiceLabels")}
            hint={tr("scenarios.separateWithCommasTheseLabelsDoNotImply")}
          >
            <input
              value={edit.ambient_voices.join(", ")}
              onChange={(e) =>
                setEdit({
                  ...edit,
                  ambient_voices: e.target.value
                    .split(",")
                    .map((x) => x.trim()),
                })
              }
            />
          </Field>
          <div className="row between">
            <h3>{tr("scenarios.theCast")}</h3>
            <Button
              onClick={() =>
                setEdit({
                  ...edit,
                  cast: [
                    ...edit.cast,
                    {
                      name: "",
                      role: "",
                      background: "",
                      persona_id: boot.personas[0]?.id || "",
                      provider_id: "glm",
                      cooldown: null,
                      muted: false,
                    },
                  ],
                })
              }
            >
              <Plus size={14} />
              {tr("scenarios.addCharacter")}
            </Button>
          </div>
          {edit.cast.map((c: Data, i: number) => (
            <div className="cast-editor" key={i}>
              <div className="row between">
                <span className="eyebrow">
                  {tr("scenarios.character", { value: i + 1 })}
                </span>
                <button
                  className="icon"
                  aria-label={"Remove character " + (i + 1)}
                  onClick={() =>
                    setEdit({
                      ...edit,
                      cast: edit.cast.filter((_: any, j: number) => j !== i),
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="form-grid">
                <Field label={tr("common.name")}>
                  <input
                    value={c.name}
                    onChange={(e) => updateCast(i, "name", e.target.value)}
                  />
                </Field>
                <Field label={tr("scenarios.publicRole")}>
                  <input
                    value={c.role}
                    onChange={(e) => updateCast(i, "role", e.target.value)}
                  />
                </Field>
                <Field label={tr("scenarios.persona")}>
                  <select
                    value={c.persona_id}
                    onChange={(e) =>
                      updateCast(i, "persona_id", e.target.value)
                    }
                  >
                    {boot.personas.map((p: Data) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={tr("scenarios.provider")}>
                  <select
                    value={c.provider_id}
                    onChange={(e) =>
                      updateCast(i, "provider_id", e.target.value)
                    }
                  >
                    {boot.providers.map((p: Data) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label={tr("scenarios.privateBackground")}>
                <textarea
                  rows={2}
                  value={c.background}
                  onChange={(e) => updateCast(i, "background", e.target.value)}
                />
              </Field>
            </div>
          ))}
          <div className="actions">
            <Button
              primary
              disabled={
                !edit.name ||
                !edit.premise ||
                !edit.cast.length ||
                edit.cast.some((c: Data) => !c.name)
              }
              onClick={async () => {
                try {
                  await api("/scenarios/" + edit.id, "PUT", edit);
                  setEdit(null);
                  await refresh();
                  notify(tr("scenarios.scenarioSaved"));
                } catch (e) {
                  fail(e);
                }
              }}
            >
              {tr("scenarios.saveScenario")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
