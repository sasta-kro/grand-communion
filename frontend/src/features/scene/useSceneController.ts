import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import { tr } from "../../i18n";
import { api } from "../../lib/api";
import { usePauseAutoFollow } from "../../lib/interfacePreferences";
import {
  BoardMessage,
  Data,
  LogRecord,
  RecapRecord,
  RequestRecord,
  SceneData,
  ScenePageProps,
} from "../../lib/types";
import { useRequestDetails } from "./useRequestDetails";
import { useSessionEvents } from "./useSessionEvents";
import { useTranscriptPosition } from "./useTranscriptPosition";

export function useSceneController({
  id,
  boot,
  refresh,
  fail,
  notify,
}: ScenePageProps) {
  const [loadError, setLoadError] = useState("");
  const [recapError, setRecapError] = useState("");
  const [scene, setScene] = useState<SceneData | null>(null),
    [requests, setRequests] = useState<RequestRecord[]>([]),
    [logs, setLogs] = useState<LogRecord[]>([]),
    [recaps, setRecaps] = useState<RecapRecord[]>([]);
  const [diagnostics, setDiagnostics] = useState(
      localStorage.getItem("communion:diagnostics") === "true",
    ),
    [tab, setTab] = useState("Status");
  useEffect(() => {
    localStorage.setItem("communion:diagnostics", String(diagnostics));
  }, [diagnostics]);
  const [text, setText] = useState(""),
    [identity, setIdentity] = useState(""),
    [custom, setCustom] = useState(""),
    [target, setTarget] = useState("everyone"),
    [reply, setReply] = useState<BoardMessage | null>(null);
  const [castOpen, setCastOpen] = useState(false),
    [sceneConfig, setSceneConfig] = useState<Data | null>(null);
  const [forkPoint, setForkPoint] = useState<number | null | undefined>(
    undefined,
  );
  const [edit, setEdit] = useState<Data | null>(null),
    [recapOpen, setRecapOpen] = useState(false),
    [saveOpen, setSaveOpen] = useState(false),
    [saves, setSaves] = useState<Data[]>([]),
    [saveName, setSaveName] = useState(tr("saves.defaultName"));
  const [scope, setScope] = useState(boot.settings.narrator_scope),
    [recapBusy, setRecapBusy] = useState(false),
    [level, setLevel] = useState(""),
    [charFilter, setCharFilter] = useState("");
  const { reqId, setReqId, detail, detailError, detailLoading, retryDetail } =
    useRequestDetails(id);
  const [newCount, setNewCount] = useState(0),
    [sending, setSending] = useState(false),
    [search, setSearch] = useState("");
  const scroll = useRef<HTMLDivElement>(null),
    pinned = useRef(true),
    cutoff = useRef(0),
    sceneRef = useRef<Data | null>(null),
    since = useRef(Number(localStorage.getItem("communion:seen:" + id) || 0));
  const pendingFocus = useRef<number | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);
  const [highlightedMessage, setHighlightedMessage] = useState<number | null>(
    null,
  );
  const messageArrivals = useRef(new Map<number, number>());
  const messageById = useMemo(
    () =>
      new Map(scene?.messages.map((message) => [message.id, message]) || []),
    [scene?.messages],
  );
  useEffect(() => {
    if (highlightedMessage === null) return;
    const timer = setTimeout(() => setHighlightedMessage(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightedMessage, focusVersion]);
  const eventCursor = useRef(0);
  const manualScrollUntil = useRef(0);
  const pauseAutoFollow = usePauseAutoFollow();
  useEffect(() => {
    if (!pauseAutoFollow) {
      pinned.current = true;
      setNewCount(0);
    }
  }, [pauseAutoFollow]);
  const filtered: BoardMessage[] = scene
    ? scene.messages.filter(
        (m: Data) =>
          !search ||
          `${m.name} ${m.text}`.toLowerCase().includes(search.toLowerCase()),
      )
    : [];
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 135,
    getItemKey: (index) => filtered[index]?.id ?? index,
    overscan: 8,
  });
  const load = async () => {
    try {
      const s = await api<SceneData>("/sessions/" + id);
      if (sceneRef.current) {
        const now = performance.now();
        for (const [messageId, arrival] of messageArrivals.current)
          if (now - arrival >= 400) messageArrivals.current.delete(messageId);
        for (const message of s.messages)
          if (
            message.id > cutoff.current &&
            !messageArrivals.current.has(message.id)
          )
            messageArrivals.current.set(message.id, now);
      }
      setLoadError("");
      setScene((old) => {
        if (old)
          s.messages = [
            ...new Map(
              [...old.messages, ...s.messages].map((m: BoardMessage) => [
                m.id,
                m,
              ]),
            ).values(),
          ].sort((a, b) => a.id - b.id);
        return s;
      });
      sceneRef.current = s;
      cutoff.current = s.cutoff;
      eventCursor.current = s.event_cursor || 0;
      setIdentity(
        (current) =>
          current ||
          "ambient:" + (s.scenario.ambient_voices[0] || "Anonymous voice"),
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      if (sceneRef.current) fail(e);
    }
  };
  const loadRequests = async () => {
    try {
      setRequests(await api(`/sessions/${id}/requests?limit=120`));
    } catch (e) {
      fail(e);
    }
  };
  const loadExtras = async () => {
    try {
      const [l, r] = await Promise.all([
        api(`/sessions/${id}/logs`),
        api(`/sessions/${id}/recaps`),
      ]);
      setLogs(l);
      setRecaps(r);
    } catch (e) {
      fail(e);
    }
  };
  useSessionEvents({
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
  });
  const { transcriptReady, following, cancelFollow, followToEnd } =
    useTranscriptPosition({
      sceneReady: !!scene,
      filtered,
      virtualizer,
      scroll,
      pinned,
      pendingFocus,
      search,
      focusVersion,
    });
  const action = async (path: string) => {
    try {
      await api(`/sessions/${id}/${path}`, "POST");
      await load();
      await refresh();
    } catch (e) {
      fail(e);
    }
  };
  const focus = async (messageId: number) => {
    try {
      if (!messageById.has(messageId)) {
        const messages = await api<BoardMessage[]>(
          `/sessions/${id}/messages?before=${messageId}&limit=15`,
        );
        if (!messages.some((message) => message.id === messageId)) {
          notify(tr("chat.originalMessageUnavailable"));
          return;
        }
        setScene((s) =>
          s
            ? {
                ...s,
                messages: [
                  ...new Map(
                    [...s.messages, ...messages].map((message) => [
                      message.id,
                      message,
                    ]),
                  ).values(),
                ].sort((a, b) => a.id - b.id),
              }
            : s,
        );
      }
      pinned.current = !pauseAutoFollow;
      pendingFocus.current = messageId;
      setSearch("");
      setRecapOpen(false);
      setHighlightedMessage(messageId);
      setFocusVersion((version) => version + 1);
    } catch (error) {
      fail(error);
    }
  };
  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api(`/sessions/${id}/messages`, "POST", {
        author_id: identity.startsWith("character:")
          ? identity.slice(10)
          : null,
        name:
          identity === "custom"
            ? custom || "Anonymous voice"
            : identity.slice(8),
        text,
        addressees: [target],
        reply_to: reply?.id || null,
      });
      setText("");
      setReply(null);
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setSending(false);
    }
  };
  const newCharacter = () =>
    setEdit({
      id: "new",
      name: "",
      role: "",
      background: "",
      persona_id: boot.personas[0]?.id || "",
      persona: boot.personas[0]?.prompt || "",
      provider_id: "glm",
      cooldown: null,
      muted: false,
      memory: "",
      memory_checkpoints: 0,
      observed: scene?.cutoff || 0,
      memory_cutoff: scene?.cutoff || 0,
    });
  const charName = (charId: string) =>
    scene?.characters.find((c: Data) => c.id === charId)?.name ||
    tr("characters.narrator");
  const active = requests.filter((r) =>
    ["queued", "requesting", "reasoning", "speaking", "backoff"].includes(
      r.status,
    ),
  );
  const complete = requests.filter((r) => r.metrics.duration_ms),
    failures = requests.filter((r) => r.status === "error");
  const latency = complete.length
    ? complete.reduce((s, r) => s + r.metrics.duration_ms, 0) / complete.length
    : 0;

  return {
    recapError,
    forkPoint,
    setForkPoint,
    setRecapError,
    transcriptReady,
    following,
    cancelFollow,
    followToEnd,
    pauseAutoFollow,
    messageById,
    messageArrivals,
    highlightedMessage,
    detailError,
    detailLoading,
    retryDetail,
    loadError,
    id,
    boot,
    refresh,
    fail,
    notify,
    scene,
    setScene,
    requests,
    logs,
    recaps,
    diagnostics,
    setDiagnostics,
    tab,
    setTab,
    text,
    setText,
    identity,
    setIdentity,
    custom,
    setCustom,
    target,
    setTarget,
    reply,
    setReply,
    castOpen,
    setCastOpen,
    sceneConfig,
    setSceneConfig,
    edit,
    setEdit,
    recapOpen,
    setRecapOpen,
    saveOpen,
    setSaveOpen,
    saves,
    setSaves,
    saveName,
    setSaveName,
    scope,
    setScope,
    recapBusy,
    setRecapBusy,
    reqId,
    setReqId,
    detail,
    level,
    setLevel,
    charFilter,
    setCharFilter,
    newCount,
    setNewCount,
    sending,
    search,
    setSearch,
    scroll,
    pinned,
    since,
    pendingFocus,
    manualScrollUntil,
    filtered,
    virtualizer,
    load,
    action,
    focus,
    send,
    newCharacter,
    charName,
    active,
    complete,
    failures,
    latency,
  };
}
export type SceneModel = Omit<
  ReturnType<typeof useSceneController>,
  "scene"
> & { scene: SceneData };
