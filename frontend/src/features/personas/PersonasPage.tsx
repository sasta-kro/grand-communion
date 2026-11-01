import { ArrowUpRight, Plus } from "lucide-react";
import { useState } from "react";
import { Button, Field, Modal, PageHeading } from "../../components/ui";
import { api } from "../../lib/api";
import { color, initials } from "../../lib/format";
import { Data, PageProps } from "../../lib/types";

export function Personas({ boot, refresh, fail, notify }: PageProps) {
  const [edit, setEdit] = useState<Data | null>(null);
  return (
    <div className="page">
      <PageHeading
        eyebrow="PERSONALITY LIBRARY"
        title="Different people. Shared dispositions."
        description="A persona can belong to several characters. Their identities and memories stay separate."
        action={
          <Button
            primary
            onClick={() =>
              setEdit({ id: crypto.randomUUID(), name: "", prompt: "" })
            }
          >
            <Plus size={17} />
            New persona
          </Button>
        }
      />
      <div className="entity-grid">
        {boot.personas.map((p: Data) => (
          <article className="entity-card" key={p.id}>
            <div className={"avatar " + color(p.name)}>{initials(p.name)}</div>
            <h2>{p.name}</h2>
            <p>{p.prompt}</p>
            <Button onClick={() => setEdit({ ...p })}>
              Edit persona
              <ArrowUpRight size={15} />
            </Button>
          </article>
        ))}
      </div>
      {edit && (
        <Modal
          title="Edit persona"
          subtitle="New sessions inherit these traits. Existing characters keep their own copy."
          onClose={() => setEdit(null)}
        >
          <Field label="Name">
            <input
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
          </Field>
          <Field label="Personality prompt">
            <textarea
              rows={7}
              value={edit.prompt}
              onChange={(e) => setEdit({ ...edit, prompt: e.target.value })}
            />
          </Field>
          <div className="actions">
            <Button
              primary
              disabled={!edit.name}
              onClick={async () => {
                try {
                  await api("/personas/" + edit.id, "PUT", edit);
                  setEdit(null);
                  await refresh();
                  notify("Persona saved");
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Save persona
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
