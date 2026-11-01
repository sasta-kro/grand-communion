import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { RequestRecord } from "../../lib/types";

const activeStatuses = new Set([
  "queued",
  "requesting",
  "reasoning",
  "speaking",
  "backoff",
]);

/** Poll active requests only. Failed loads stay visible with an explicit retry. */
export function useRequestDetails(id: string) {
  const [reqId, setReqId] = useState("");
  const [detail, setDetail] = useState<RequestRecord | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setDetail(null);
    setDetailError("");
    setDetailLoading(!!reqId);
    if (!reqId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const update = async () => {
      try {
        const record = await api<RequestRecord>(
          `/sessions/${id}/requests/${reqId}`,
        );
        if (!alive) return;
        setDetail(record);
        setDetailLoading(false);
        setDetailError("");
        if (activeStatuses.has(record.status)) timer = setTimeout(update, 1500);
      } catch (error) {
        if (alive) {
          setDetailLoading(false);
          setDetailError(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    };
    void update();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id, reqId, revision]);
  return {
    reqId,
    setReqId,
    detail,
    detailError,
    detailLoading,
    retryDetail: () => setRevision((value) => value + 1),
  };
}
