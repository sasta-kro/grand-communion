import { BookOpen } from "lucide-react";
import { Button, Modal } from "../../components/ui";
import { api } from "../../lib/api";
import { date } from "../../lib/format";
import { Data } from "../../lib/types";
import { SceneModel } from "./useSceneController";

export function RecapDialog({ model }: { model: SceneModel }) {
  const {
    id,
    fail,
    recaps,
    recapOpen,
    setRecapOpen,
    scope,
    setScope,
    recapBusy,
    setRecapBusy,
    since,
    focus,
  } = model;

  return (
    <>
      {" "}
      {recapOpen && (
        <Modal
          title="The chronicle"
          subtitle="An observer's account. Never fed back into the world."
          wide
          onClose={() => setRecapOpen(false)}
        >
          <div className="recap-controls">
            <select
              aria-label="Narrator access"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="public">Public events only</option>
              <option value="private">
                Include private memories and reasoning
              </option>
            </select>
            <Button
              disabled={recapBusy}
              onClick={async () => {
                try {
                  await api(`/sessions/${id}/recaps`, "POST", {
                    after_id: since.current,
                    scope,
                  });
                  setRecapBusy(true);
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Since my last visit
            </Button>
            <Button
              primary
              disabled={recapBusy}
              onClick={async () => {
                try {
                  await api(`/sessions/${id}/recaps`, "POST", {
                    after_id: 0,
                    scope,
                  });
                  setRecapBusy(true);
                } catch (e) {
                  fail(e);
                }
              }}
            >
              {recapBusy ? "Preparing the chronicle..." : "Recap the session"}
            </Button>
          </div>
          {!recaps.length && (
            <div className="empty-inline">
              <BookOpen size={32} />
              <h3>A story waiting to be told.</h3>
              <p>
                Prepare a recap now, or let the scheduled narrator gather the
                next chapter.
              </p>
            </div>
          )}
          {recaps.map((r) => (
            <article className="recap" key={r.id}>
              <div className="row between">
                <span className="eyebrow">{date(r.created)}</span>
                <span className="quiet tiny">
                  {r.scope === "private"
                    ? "Includes private material"
                    : "Public account"}{" "}
                  · #{r.after_id}–#{r.cutoff}
                </span>
              </div>
              <h2>{r.body.title}</h2>
              <p className="narrative">{r.body.narrative}</p>
              {r.body.notable.length > 0 && (
                <>
                  <h4>NOTABLE MOMENTS</h4>
                  {r.body.notable.map((n: Data, i: number) => (
                    <div className="notable" key={i}>
                      <p>{n.text}</p>
                      {n.message_ids.map((m: number) => (
                        <button key={m} onClick={() => focus(m)}>
                          #{m}
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              )}
              {r.body.unresolved.length > 0 && (
                <>
                  <h4>UNRESOLVED THREADS</h4>
                  <ul>
                    {r.body.unresolved.map((u: string, i: number) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          ))}
        </Modal>
      )}
    </>
  );
}
