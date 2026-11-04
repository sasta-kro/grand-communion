import { Archive, ArchiveRestore, MoreHorizontal, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { tr } from "../i18n";
import { api } from "../lib/api";
import { Button, Field, Modal } from "./ui";

type ItemKind = "sessions" | "scenarios" | "personas" | "saves";
const deleteDescriptions = {
  sessions: "lifecycle.deleteDescription.sessions",
  scenarios: "lifecycle.deleteDescription.scenarios",
  personas: "lifecycle.deleteDescription.personas",
  saves: "lifecycle.deleteDescription.saves",
} as const;
const archiveDescriptions = {
  sessions: "lifecycle.archiveDescription.sessions",
  scenarios: "lifecycle.archiveDescription.scenarios",
  personas: "lifecycle.archiveDescription.personas",
  saves: "lifecycle.deleteDescription.saves",
} as const;
interface ItemManagementProps {
  kind: ItemKind;
  item: { id: string; name: string };
  archived?: boolean;
  changed: (removed?: boolean) => Promise<unknown>;
  deleted?: () => void;
  labeled?: boolean;
}

export function ItemManagement({
  kind,
  item,
  archived = false,
  changed,
  deleted,
  labeled = false,
}: ItemManagementProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        className="item-manage"
        title={tr("lifecycle.manageItem", { name: item.name })}
        aria-label={tr("lifecycle.manageItem", { name: item.name })}
        onClick={() => setOpen(true)}
      >
        <MoreHorizontal size={18} />
        {labeled && <span>{tr("lifecycle.manage")}</span>}
      </Button>
      {open && (
        <ManageItemDialog
          kind={kind}
          item={item}
          archived={archived}
          changed={changed}
          deleted={deleted}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function ManageItemDialog({
  kind,
  item,
  archived = false,
  changed,
  deleted,
  onClose,
}: ItemManagementProps & { onClose: () => void }) {
  const [confirm, setConfirm] = useState(kind === "saves");
  const [name, setName] = useState(item.name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const perform = async (
    work: () => Promise<unknown>,
    after?: () => void,
    removed = false,
  ) => {
    setBusy(true);
    setError("");
    try {
      await work();
      await changed(removed);
      onClose();
      after?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={tr(confirm ? "lifecycle.deleteItem" : "lifecycle.manageItem", {
        name: item.name,
      })}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {confirm ? (
        <>
          <p>{tr(deleteDescriptions[kind])}</p>
          <p className="quiet">
            {tr(
              kind === "saves"
                ? "lifecycle.checkpointCannotUndo"
                : "lifecycle.cannotUndo",
            )}
          </p>
          <div className="actions">
            <Button
              disabled={busy}
              onClick={() => (kind === "saves" ? onClose() : setConfirm(false))}
            >
              {tr("common.cancel")}
            </Button>
            <Button
              disabled={busy}
              className="danger"
              onClick={() =>
                perform(
                  () => api(`/${kind}/${item.id}`, "DELETE"),
                  deleted,
                  true,
                )
              }
            >
              <Trash2 size={16} />
              {tr("lifecycle.deletePermanently")}
            </Button>
          </div>
        </>
      ) : (
        <>
          {kind === "sessions" && (
            <Field label={tr("common.name")}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
          )}
          {kind === "sessions" && (
            <Button
              disabled={busy || !name.trim() || name.trim() === item.name}
              onClick={() =>
                perform(() =>
                  api(`/sessions/${item.id}`, "PUT", { name: name.trim() }),
                )
              }
            >
              {tr("lifecycle.saveName")}
            </Button>
          )}
          <div className="management-section">
            <p>{tr(archiveDescriptions[kind])}</p>
            <Button
              disabled={busy}
              onClick={() =>
                perform(() =>
                  api(`/${kind}/${item.id}/archive`, "POST", {
                    archived: !archived,
                  }),
                )
              }
            >
              {archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              {tr(archived ? "lifecycle.restore" : "lifecycle.archive")}
            </Button>
          </div>
          <div className="management-section">
            <p>{tr(deleteDescriptions[kind])}</p>
            <Button
              disabled={busy}
              className="danger"
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={16} />
              {tr("lifecycle.deletePermanently")}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function ArchiveFilter({
  archived,
  setArchived,
}: {
  archived: boolean;
  setArchived: (value: boolean) => void;
}) {
  return (
    <div
      className="archive-filter"
      role="group"
      aria-label={tr("lifecycle.filter")}
    >
      <Button
        className={archived ? "" : "active"}
        aria-pressed={!archived}
        onClick={() => setArchived(false)}
      >
        {tr("lifecycle.active")}
      </Button>
      <Button
        className={archived ? "active" : ""}
        aria-pressed={archived}
        onClick={() => setArchived(true)}
      >
        <Archive size={15} />
        {tr("lifecycle.archived")}
      </Button>
    </div>
  );
}

export function useArchiveList<T>(
  kind: "sessions" | "scenarios" | "personas",
  active: T[],
  fail: (error: unknown) => void,
) {
  const [archived, setArchived] = useState(false);
  const [archivedItems, setArchivedItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!archived) return;
    let disposed = false;
    setLoading(true);
    setError("");
    api<T[]>(
      kind === "sessions"
        ? "/sessions?archived=true"
        : `/library/${kind}?archived=true`,
    )
      .then((rows) => {
        if (!disposed) setArchivedItems(rows);
      })
      .catch((reason) => {
        if (!disposed) {
          setError(String(reason));
          fail(reason);
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [kind, archived, active, revision]);
  return {
    archived,
    setArchived,
    items: archived ? archivedItems : active,
    loading,
    error,
    retry: () => setRevision((n) => n + 1),
  };
}
