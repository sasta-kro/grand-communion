import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { RequestRecord } from "../../lib/types";

/** Poll details only while a request is selected, without polling the transcript. */
export function useRequestDetails(id: string) {
  const [reqId, setReqId] = useState("");
  const [detail, setDetail] = useState<RequestRecord | null>(null);
  useEffect(() => {
    if (!reqId) {
      setDetail(null);
      return;
    }
    let alive = true;
    const update = () =>
      api(`/sessions/${id}/requests/${reqId}`)
        .then((r) => alive && setDetail(r))
        .catch(() => {});
    update();
    const t = setInterval(update, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [reqId]);
  return { reqId, setReqId, detail };
}
