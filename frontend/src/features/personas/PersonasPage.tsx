import { ArrowUpRight, Plus } from "lucide-react";
import { useState } from "react";
import { Button, Field, Modal, PageHeading } from "../../components/ui";
import { tr } from "../../i18n";
import { api } from "../../lib/api";
import { color, initials } from "../../lib/format";
import { Data, PageProps } from "../../lib/types";
import {
  ArchiveFilter,
  ItemManagement,
  useArchiveList,
} from "../../components/ItemManagement";

export function Personas({ boot, refresh, fail, notify }: PageProps) {
  const [edit, setEdit] = useState<Data | null>(null);
  const { archived, setArchived, items, loading, error, retry } =
    useArchiveList("personas", boot.personas, fail);
  return (
    <div className="page">
      <PageHeading
        eyebrow=""
        title={tr("navigation.personas")}
        description={tr("personas.aPersonaCanBelongToSeveralCharactersTheir")}
        action={
          <Button
            primary
            onClick={() =>
              setEdit({ id: crypto.randomUUID(), name: "", prompt: "" })
            }
          >
            <Plus size={17} />
            {tr("personas.newPersona")}
          </Button>
        }
      />
      <ArchiveFilter archived={archived} setArchived={setArchived} />
      {loading && <p role="status">{tr("lifecycle.loadingArchive")}</p>}
      {error && <Button onClick={retry}>{tr("common.retry")}</Button>}
      {!loading && !error && !items.length && (
        <p className="empty-state">
          {tr(archived ? "lifecycle.archiveEmpty" : "lifecycle.libraryEmpty")}
        </p>
      )}
      <div className="entity-grid">
        {items.map((p: Data) => (
          <article className="entity-card" key={p.id}>
            <div className={"avatar " + color(p.name)}>{initials(p.name)}</div>
            <h2>{p.name}</h2>
            <p>{p.prompt}</p>
            <Button onClick={() => setEdit({ ...p })}>
              {tr("personas.editPersona")}
              <ArrowUpRight size={15} />
            </Button>
            <ItemManagement
              kind="personas"
              item={{ id: p.id, name: p.name }}
              archived={archived}
              changed={refresh}
            />
          </article>
        ))}
      </div>
      {edit && (
        <Modal
          title={tr("personas.editPersona")}
          subtitle={tr(
            "personas.newSessionsInheritTheseTraitsExistingCharactersKeep",
          )}
          onClose={() => setEdit(null)}
        >
          <Field label={tr("common.name")}>
            <input
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
          </Field>
          <Field label={tr("personas.personalityPrompt")}>
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
                  notify(tr("personas.personaSaved"));
                } catch (e) {
                  fail(e);
                }
              }}
            >
              {tr("personas.savePersona")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
