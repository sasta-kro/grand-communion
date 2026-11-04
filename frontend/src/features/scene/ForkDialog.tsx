import { GitFork } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Field, Modal } from "../../components/ui";
import { tr } from "../../i18n";
import { api } from "../../lib/api";
import { go } from "../../lib/navigation";
import { forkWarningText } from "../../lib/lifecycle";
import { Data } from "../../lib/types";
import { SceneModel } from "./useSceneController";

export function ForkDialog({ model }: { model: SceneModel }) {
  const { id, scene, forkPoint, setForkPoint, refresh } = model;
  const [name, setName] = useState(
    scene.name.slice(0, 130) + tr("lifecycle.forkSuffix"),
  );
  const [preview, setPreview] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let disposed = false;
    setPreview(null);
    setError("");
    api(
      `/sessions/${id}/fork${forkPoint === null ? "" : `?message_id=${forkPoint}`}`,
    )
      .then((result) => {
        if (!disposed) {
          if (forkPoint === null) setForkPoint(result.message_id);
          else setPreview(result);
        }
      })
      .catch((reason) => {
        if (!disposed) setError(String(reason));
      });
    return () => {
      disposed = true;
    };
  }, [id, forkPoint, revision]);
  return (
    <Modal
      title={tr("lifecycle.forkSession")}
      subtitle={tr("lifecycle.forkDescription")}
      onClose={() => {
        if (!busy) setForkPoint(undefined);
      }}
    >
      <Field label={tr("lifecycle.newSessionName")}>
        <input
          value={name}
          maxLength={150}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      {preview ? (
        <div className="info-box">
          <p>
            {tr("lifecycle.forkCounts", {
              characters: preview.character_count,
              messages: preview.message_count,
            })}
          </p>
          {preview.message ? (
            <>
              <strong>
                {tr("lifecycle.throughMessage", {
                  id: preview.message_id,
                  name: preview.message.name,
                })}
              </strong>
              <p>{preview.message.text}</p>
            </>
          ) : (
            <p>{tr("lifecycle.beforeFirstMessage")}</p>
          )}
          {preview.warnings.map((warning: string) => (
            <p className="fork-warning" key={warning}>
              {forkWarningText(warning)}
            </p>
          ))}
        </div>
      ) : (
        !error && <p role="status">{tr("lifecycle.loadingFork")}</p>
      )}
      {error && (
        <div className="alert" role="alert">
          {error}
          <Button onClick={() => setRevision((n) => n + 1)}>
            {tr("common.retry")}
          </Button>
        </div>
      )}
      <div className="actions">
        <Button disabled={busy} onClick={() => setForkPoint(undefined)}>
          {tr("common.cancel")}
        </Button>
        <Button
          primary
          disabled={!preview || !name.trim() || busy || !!error}
          onClick={async () => {
            if (!preview) return;
            setBusy(true);
            setError("");
            try {
              const result = await api(`/sessions/${id}/fork`, "POST", {
                message_id: forkPoint,
                name: name.trim(),
                expected_warnings: preview.warnings,
              });
              await refresh();
              setForkPoint(undefined);
              go("/scene/" + result.id);
            } catch (reason) {
              setError(String(reason));
            } finally {
              setBusy(false);
            }
          }}
        >
          <GitFork size={16} />
          {tr("lifecycle.createFork")}
        </Button>
      </div>
    </Modal>
  );
}
