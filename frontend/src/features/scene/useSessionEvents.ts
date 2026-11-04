import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect } from "react";

interface SessionEventsOptions {
  id: string;
  load: () => Promise<void>;
  loadRequests: () => Promise<void>;
  loadExtras: () => Promise<void>;
  cutoff: MutableRefObject<number>;
  eventCursor: MutableRefObject<number>;
  pinned: MutableRefObject<boolean>;
  setNewCount: Dispatch<SetStateAction<number>>;
  setRecapBusy: Dispatch<SetStateAction<boolean>>;
  setRecapError: Dispatch<SetStateAction<string>>;
  fail: (error: unknown) => void;
}

/** Subscribe after the initial snapshot, batch updates, and clean up on scene exit. */
export function useSessionEvents({
  id,
  load,
  loadRequests,
  loadExtras,
  cutoff,
  pinned,
  eventCursor,
  setNewCount,
  setRecapBusy,
  setRecapError,
  fail,
}: SessionEventsOptions) {
  useEffect(() => {
    localStorage.setItem("communion:lastSession", id);
    loadRequests();
    loadExtras();
    let stream: EventSource | null = null;
    let disposed = false;
    let sceneTimer: ReturnType<typeof setTimeout>;
    let requestTimer: ReturnType<typeof setTimeout> | null = null;
    let extraTimer: ReturnType<typeof setTimeout>;
    const onUpdate = (event: MessageEvent<string>) => {
      const e = JSON.parse(event.data);
      if (["message", "session", "memory"].includes(e.kind)) {
        if (
          e.kind === "message" &&
          e.body.id > cutoff.current &&
          !pinned.current
        )
          setNewCount((n) => n + 1);
        clearTimeout(sceneTimer);
        sceneTimer = setTimeout(load, 180);
      }
      if (e.kind === "request" && !requestTimer)
        requestTimer = setTimeout(() => {
          loadRequests();
          requestTimer = null;
        }, 900);
      if (["log", "recap", "recap_finished"].includes(e.kind)) {
        clearTimeout(extraTimer);
        extraTimer = setTimeout(loadExtras, 300);
        if (e.kind === "recap_finished") {
          setRecapBusy(false);
          if (e.body.error) {
            setRecapError(e.body.error);
            fail(new Error(e.body.error));
          }
        }
      }
    };
    load().then(() => {
      if (disposed) return;
      stream = new EventSource(
        `/api/sessions/${id}/events?after=${eventCursor.current}`,
      );
      stream.addEventListener("update", onUpdate);
    });
    return () => {
      disposed = true;
      stream?.close();
      clearTimeout(sceneTimer);
      clearTimeout(requestTimer ?? undefined);
      clearTimeout(extraTimer);
      localStorage.setItem("communion:seen:" + id, String(cutoff.current));
    };
  }, [id]);
}
