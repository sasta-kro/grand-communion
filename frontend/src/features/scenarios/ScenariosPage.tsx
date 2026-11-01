import { ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Field, Modal, PageHeading } from "../../components/ui";
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
        eyebrow="STARTING CONDITIONS"
        title="A place. A cast. A possibility."
        description="Scenarios are reusable beginnings. Each session becomes its own world."
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
            New scenario
          </Button>
        }
      />
      <div className="entity-grid">
        {boot.scenarios.map((s: Data) => (
          <article className="entity-card scenario-card" key={s.id}>
            <span className="eyebrow">{s.cast.length} CHARACTERS</span>
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
                Edit setting
              </Button>
              <Button primary onClick={() => onCreateSession(s.id)}>
                Start here
                <ArrowUpRight size={15} />
              </Button>
            </div>
          </article>
        ))}
      </div>
      {edit && (
        <Modal
          title="Build a scenario"
          subtitle="Every character receives the shared setting and only their own private background."
          wide
          onClose={() => setEdit(null)}
        >
          <Field label="Name">
            <input
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
          </Field>
          <Field label="Short description">
            <input
              value={edit.description}
              onChange={(e) =>
                setEdit({ ...edit, description: e.target.value })
              }
            />
          </Field>
          <Field label="Shared opening premise">
            <textarea
              rows={5}
              value={edit.premise}
              onChange={(e) => setEdit({ ...edit, premise: e.target.value })}
            />
          </Field>
          <Field
            label="Ambient voice labels"
            hint="Separate with commas. These labels do not imply a single recurring person."
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
            <h3>The cast</h3>
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
              Add character
            </Button>
          </div>
          {edit.cast.map((c: Data, i: number) => (
            <div className="cast-editor" key={i}>
              <div className="row between">
                <span className="eyebrow">CHARACTER {i + 1}</span>
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
                <Field label="Name">
                  <input
                    value={c.name}
                    onChange={(e) => updateCast(i, "name", e.target.value)}
                  />
                </Field>
                <Field label="Public role">
                  <input
                    value={c.role}
                    onChange={(e) => updateCast(i, "role", e.target.value)}
                  />
                </Field>
                <Field label="Persona">
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
                <Field label="Provider">
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
              <Field label="Private background">
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
                  notify("Scenario saved");
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Save scenario
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
