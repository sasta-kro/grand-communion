import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Compass,
  MessagesSquare,
  Layers,
  Users,
  Plug,
  Settings as SettingsIcon,
  Play,
  Pause,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Activity,
  BookOpen,
  Save,
  X,
  Send,
  ChevronDown,
  ChevronRight,
  Check,
  Download,
  Upload,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Clock,
  Eye,
  Trash2,
} from "lucide-react";
import "./style.css";

type Data = Record<string, any>;
async function api(path: string, method = "GET", body?: unknown): Promise<any> {
  const response = await fetch("/api" + path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail || "Request failed"),
    );
  return data;
}
const stamp = (t: number) =>
  new Date(t * 1000).toLocaleTimeString("en-GB", { hour12: false });
const date = (t: number) =>
  new Date(t * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const fmt = (n: number | undefined) =>
  n == null
    ? "Unknown"
    : new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
const seconds = (n: number) =>
  n == null
    ? ""
    : n < 1000
      ? `${Math.round(n)} ms`
      : `${(n / 1000).toFixed(1)} s`;
const go = (path: string) => {
  window.location.hash = path;
};
const initials = (name: string) =>
  name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
const color = (name: string) =>
  ["sage", "ochre", "blue", "mauve"][
    [...name].reduce((a, b) => a + b.charCodeAt(0), 0) % 4
  ];
function Button({
  children,
  onClick,
  primary = false,
  disabled = false,
  className = "",
  title,
}: any) {
  return (
    <button
      title={title}
      className={`button ${primary ? "primary" : ""} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Field({ label, children, hint }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Modal({ title, subtitle, children, onClose, wide = false }: any) {
  return (
    <div
      className="scrim"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
      >
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
function Badge({ value }: any) {
  return (
    <span className={`badge ${value}`}>
      <i />
      {String(value).replaceAll("_", " ")}
    </span>
  );
}
function App() {
  const [boot, setBoot] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [route, setRoute] = useState(location.hash.slice(1) || "/sessions");
  const [create, setCreate] = useState(false),
    [scenario, setScenario] = useState(""),
    [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const notify = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(""), 4000);
  };
  const fail = (e: any) => setError(e.message || String(e));
  const refresh = async () => {
    try {
      setBoot(await api("/bootstrap"));
    } catch (e) {
      fail(e);
    }
  };
  useEffect(() => {
    refresh();
    const fn = () => {
      setRoute(location.hash.slice(1) || "/sessions");
      setError("");
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);
  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  if (!boot)
    return (
      <div className="loading">
        <Compass size={38} />
        <h1>Communion</h1>
        <p>{error || "Opening your worlds..."}</p>
        {error && <Button onClick={refresh}>Retry</Button>}
      </div>
    );
  const section = route.split("/")[1],
    sessionId = route.split("/")[2];
  const active = boot.sessions.filter(
    (s: Data) => s.status === "running",
  ).length;
  const common = { boot, refresh, fail, notify };
  const newSession = () => {
    setScenario(boot.scenarios[0]?.id || "");
    setCreate(true);
  };
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="#/sessions">
          <Compass size={27} />
          <span>
            Communion<small>WORLDS IN CONVERSATION</small>
          </span>
        </a>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          <a
            className={section === "sessions" ? "selected" : ""}
            href="#/sessions"
          >
            <Layers size={18} />
            Sessions<span>{boot.sessions.length || ""}</span>
          </a>
          <a
            className={section === "scene" ? "selected" : ""}
            href={
              localStorage.getItem("communion:lastSession")
                ? `#/scene/${localStorage.getItem("communion:lastSession")}`
                : "#/sessions"
            }
          >
            <MessagesSquare size={18} />
            Scene
          </a>
          <a
            className={section === "scenarios" ? "selected" : ""}
            href="#/scenarios"
          >
            <BookOpen size={18} />
            Scenarios
          </a>
          <a
            className={section === "personas" ? "selected" : ""}
            href="#/personas"
          >
            <Users size={18} />
            Personas
          </a>
          <div className="nav-caption">CONFIGURATION</div>
          <a
            className={section === "providers" ? "selected" : ""}
            href="#/providers"
          >
            <Plug size={18} />
            Providers
          </a>
          <a
            className={section === "settings" ? "selected" : ""}
            href="#/settings"
          >
            <SettingsIcon size={18} />
            Settings
          </a>
        </nav>
        <div className="sidebar-bottom">
          <span className={`dot ${active ? "live" : ""}`} />
          <div>
            {active
              ? `${active} ${active === 1 ? "world" : "worlds"} running`
              : "All worlds at rest"}
            <small>Local engine · Python / FastAPI</small>
          </div>
        </div>
      </aside>
      <main className={section === "scene" ? "scene-main" : ""}>
        {error && (
          <div className="alert" role="alert">
            {error}
            <button
              aria-label="Dismiss error"
              className="icon"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {section === "scene" && sessionId ? (
          <Scene key={sessionId} id={sessionId} {...common} />
        ) : section === "personas" ? (
          <Personas {...common} />
        ) : section === "scenarios" ? (
          <Scenarios
            {...common}
            onCreateSession={(id: string) => {
              setScenario(id);
              setCreate(true);
            }}
          />
        ) : section === "providers" ? (
          <Providers {...common} />
        ) : section === "settings" ? (
          <Preferences {...common} />
        ) : (
          <>
            <div className="page-top">
              <span className="eyebrow">YOUR WORLDS</span>
              <span className="quiet">Everything stays on this machine.</span>
            </div>
            <div className="page-heading">
              <div>
                <h1>Leave a world in motion.</h1>
                <p>
                  Gather a cast. Set the scene. Come back to a story that
                  carried on.
                </p>
              </div>
              <Button primary onClick={newSession}>
                <Plus size={17} />
                New session
              </Button>
            </div>
            {boot.sessions.length === 0 ? (
              <div className="welcome">
                <div className="orbital">
                  <Compass size={64} />
                </div>
                <span className="eyebrow">A PLACE TO BEGIN</span>
                <h2>Every world starts with a gathering.</h2>
                <p>
                  Choose a setting and bring six distinct voices into it.
                  <br />
                  Their memories stay their own. Their conversation is shared.
                </p>
                <Button primary onClick={newSession}>
                  Create your first session
                  <ArrowUpRight size={16} />
                </Button>
              </div>
            ) : (
              <div className="session-grid">
                {boot.sessions.map((s: Data) => (
                  <article className="session-card" key={s.id}>
                    <div className="row between">
                      <Badge value={s.status} />
                      <span className="quiet">{date(s.updated)}</span>
                    </div>
                    <button
                      className="card-link"
                      onClick={() => {
                        localStorage.setItem("communion:lastSession", s.id);
                        go("/scene/" + s.id);
                      }}
                    >
                      <h2>{s.name}</h2>
                      <ArrowUpRight size={20} />
                    </button>
                    <p className="quiet">
                      {s.character_count} characters · {fmt(s.message_count)}{" "}
                      messages
                    </p>
                    <div className="card-footer">
                      <Button onClick={() => go("/scene/" + s.id)}>
                        Open scene
                        <ChevronRight size={15} />
                      </Button>
                      <button
                        title={
                          s.status === "running"
                            ? "Pause session"
                            : "Resume session"
                        }
                        className="icon"
                        onClick={() =>
                          run(async () => {
                            await api(
                              `/sessions/${s.id}/${s.status === "running" ? "pause" : "start"}`,
                              "POST",
                            );
                            await refresh();
                          })
                        }
                      >
                        {s.status === "running" ? (
                          <Pause size={17} />
                        ) : (
                          <Play size={17} />
                        )}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="section-heading">
              <div>
                <h2>Three starting points</h2>
                <p>
                  Fresh worlds you can change into something entirely your own.
                </p>
              </div>
              <a href="#/scenarios">
                Explore scenarios
                <ArrowUpRight size={15} />
              </a>
            </div>
            <div className="world-grid">
              {boot.scenarios.slice(0, 3).map((s: Data, i: number) => (
                <article className="world-card" key={s.id}>
                  <div className="world-number">
                    0{i + 1}
                    <span>
                      {(
                        {
                          lantern: "VIGIL",
                          observatory: "DISCOVERY",
                          floodgate: "ENCOUNTER",
                        } as Record<string, string>
                      )[s.id] || "WORLD"}
                    </span>
                  </div>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <button
                    onClick={() => {
                      setScenario(s.id);
                      setCreate(true);
                    }}
                  >
                    Gather this cast
                    <ArrowUpRight size={16} />
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {create && (
        <Modal
          title="Start a new world"
          subtitle="A new conversation with its own history and memories."
          onClose={() => setCreate(false)}
        >
          <Field label="Scenario">
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              {boot.scenarios.map((s: Data) => (
                <option value={s.id} key={s.id}>
                  {s.name} · {s.cast.length} characters
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Session name"
            hint="Leave blank to use the scenario name."
          >
            <input
              placeholder="An evening at the gathering"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="info-box">
            The session opens paused. You choose when its characters begin.
          </div>
          <div className="actions">
            <Button onClick={() => setCreate(false)}>Cancel</Button>
            <Button
              primary
              disabled={busy || !scenario}
              onClick={() =>
                run(async () => {
                  const s = await api("/sessions", "POST", {
                    scenario_id: scenario,
                    name,
                  });
                  setCreate(false);
                  setName("");
                  localStorage.setItem("communion:lastSession", s.id);
                  await refresh();
                  go("/scene/" + s.id);
                })
              }
            >
              Create session
              <ArrowUpRight size={16} />
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Scene({ id, boot, refresh, fail, notify }: any) {
  const [scene, setScene] = useState<Data | null>(null),
    [requests, setRequests] = useState<Data[]>([]),
    [logs, setLogs] = useState<Data[]>([]),
    [recaps, setRecaps] = useState<Data[]>([]);
  const [diagnostics, setDiagnostics] = useState(
      localStorage.getItem("communion:diagnostics") === "true",
    ),
    [tab, setTab] = useState("Status");
  const [text, setText] = useState(""),
    [identity, setIdentity] = useState(""),
    [custom, setCustom] = useState(""),
    [target, setTarget] = useState("everyone"),
    [reply, setReply] = useState<Data | null>(null);
  const [castOpen, setCastOpen] = useState(false),
    [sceneConfig, setSceneConfig] = useState<Data | null>(null);
  const [edit, setEdit] = useState<Data | null>(null),
    [recapOpen, setRecapOpen] = useState(false),
    [saveOpen, setSaveOpen] = useState(false),
    [saves, setSaves] = useState<Data[]>([]),
    [saveName, setSaveName] = useState("Checkpoint");
  const [scope, setScope] = useState(boot.settings.narrator_scope),
    [recapBusy, setRecapBusy] = useState(false),
    [reqId, setReqId] = useState(""),
    [detail, setDetail] = useState<Data | null>(null),
    [level, setLevel] = useState(""),
    [charFilter, setCharFilter] = useState("");
  const [newCount, setNewCount] = useState(0),
    [sending, setSending] = useState(false),
    [search, setSearch] = useState("");
  const scroll = useRef<HTMLDivElement>(null),
    pinned = useRef(true),
    cutoff = useRef(0),
    sceneRef = useRef<Data | null>(null),
    since = useRef(Number(localStorage.getItem("communion:seen:" + id) || 0));
  const pendingFocus = useRef<number | null>(null);
  const eventCursor = useRef(0);
  const manualScrollUntil = useRef(0);
  const filtered: Data[] = scene
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
      const s = await api("/sessions/" + id);
      setScene((old) => {
        if (old)
          s.messages = [
            ...new Map(
              [...old.messages, ...s.messages].map((m: Data) => [m.id, m]),
            ).values(),
          ].sort((a: any, b: any) => a.id - b.id);
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
      fail(e);
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
  useEffect(() => {
    localStorage.setItem("communion:lastSession", id);
    loadRequests();
    loadExtras();
    let stream: EventSource | null = null;
    let disposed = false;
    let sceneTimer: any, requestTimer: any, extraTimer: any;
    const onUpdate = (event: any) => {
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
          if (e.body.error) fail(new Error(e.body.error));
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
      clearTimeout(requestTimer);
      clearTimeout(extraTimer);
      localStorage.setItem("communion:seen:" + id, String(cutoff.current));
    };
  }, [id]);
  useEffect(() => {
    if (pendingFocus.current !== null) {
      const index = filtered.findIndex((m) => m.id === pendingFocus.current);
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: "center" });
        pendingFocus.current = null;
      }
    } else if (pinned.current && filtered.length) {
      virtualizer.scrollToIndex(filtered.length - 1, { align: "end" });
    }
  }, [scene?.cutoff, filtered.length, search, virtualizer.getTotalSize()]);
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
    pinned.current = false;
    pendingFocus.current = messageId;
    setSearch("");
    if (!scene?.messages.some((m: Data) => m.id === messageId)) {
      const m = await api(
        `/sessions/${id}/messages?after=${Math.max(0, messageId - 5)}&limit=15`,
      );
      setScene((s) =>
        s
          ? {
              ...s,
              messages: [
                ...new Map(
                  [...s.messages, ...m].map((x: Data) => [x.id, x]),
                ).values(),
              ].sort((a: any, b: any) => a.id - b.id),
            }
          : s,
      );
    }
    setRecapOpen(false);
    setTimeout(() => {
      const index = filtered.findIndex((m) => m.id === messageId);
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: "center" });
        pendingFocus.current = null;
      }
    }, 80);
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
  if (!scene)
    return (
      <div className="loading">
        <Compass size={30} />
        <p>Opening scene...</p>
      </div>
    );
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
    scene.characters.find((c: Data) => c.id === charId)?.name || "Narrator";
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
  return (
    <div className="scene-shell">
      <header className="scene-header">
        <div>
          <a href="#/sessions" className="back">
            <ArrowLeft size={13} />
            Sessions
          </a>
          <h1>{scene.name}</h1>
          <div className="row">
            <Badge value={scene.status} />
            <span className="quiet">
              {scene.characters.length} voices ·{" "}
              {fmt(scene.cutoff ? scene.messages.length : 0)} loaded messages
            </span>
          </div>
        </div>
        <div className="scene-actions">
          <Button
            title="Scene settings"
            onClick={() => setSceneConfig({ ...scene.settings })}
          >
            <SlidersHorizontal size={16} />
            <span>Settings</span>
          </Button>
          <Button className="mobile-cast" onClick={() => setCastOpen(true)}>
            <Users size={16} />
            <span>Cast</span>
          </Button>
          <Button onClick={() => setRecapOpen(true)}>
            <BookOpen size={16} />
            <span>Recap</span>
          </Button>
          <Button
            onClick={async () => {
              setSaves(await api(`/sessions/${id}/saves`));
              setSaveOpen(true);
            }}
          >
            <Save size={16} />
            <span>Save</span>
          </Button>
          <Button
            className={diagnostics ? "active" : ""}
            onClick={() => {
              setDiagnostics(!diagnostics);
              localStorage.setItem(
                "communion:diagnostics",
                String(!diagnostics),
              );
            }}
          >
            <Activity size={16} />
            <span>Diagnostics</span>
          </Button>
          <Button
            primary
            onClick={() =>
              action(scene.status === "running" ? "pause" : "start")
            }
          >
            {scene.status === "running" ? (
              <Pause size={16} />
            ) : (
              <Play size={16} />
            )}
            <span>{scene.status === "running" ? "Pause" : "Resume"}</span>
          </Button>
        </div>
      </header>
      <div className={`scene-layout ${diagnostics ? "with-diagnostics" : ""}`}>
        <aside className="roster">
          <div className="row between">
            <h3>In this scene</h3>
            <button
              className="icon"
              title="Add character"
              onClick={newCharacter}
            >
              <Plus size={14} />
            </button>
          </div>
          {scene.characters.map((c: Data) => {
            const latest = requests.find(
              (r) => r.character_id === c.id && r.kind === "character",
            );
            const phase =
              latest && active.includes(latest) ? latest.status : c.phase;
            return (
              <button
                className="character-row"
                key={c.id}
                onClick={() => setEdit({ ...c })}
              >
                <span className={"avatar " + color(c.name)}>
                  {initials(c.name)}
                </span>
                <span>
                  <strong>{c.name}</strong>
                  <small>{c.role}</small>
                  <em className={phase === "error" ? "error-text" : ""}>
                    {c.muted
                      ? "Quiet · still listening"
                      : phase === "cooldown"
                        ? "Listening"
                        : phase}
                  </em>
                </span>
                <ChevronRight size={13} />
              </button>
            );
          })}
          <div className="roster-note">
            <Eye size={15} />
            <p>
              You observe from outside the world. The characters hear only what
              you choose to say within it.
            </p>
          </div>
          <div className="scene-premise">
            <span className="eyebrow">THE SETTING</span>
            <p>{scene.scenario.premise}</p>
          </div>
        </aside>
        <section className="conversation">
          <div className="transcript-toolbar">
            <span>PUBLIC CONVERSATION</span>
            {scene.messages.length >= 200 && (
              <button
                className="text-button quiet"
                onClick={async () => {
                  try {
                    const first = scene.messages[0].id;
                    const rows = await api(
                      `/sessions/${id}/messages?before=${first - 1}&limit=200`,
                    );
                    pinned.current = false;
                    pendingFocus.current = first;
                    setScene({
                      ...scene,
                      messages: [...rows, ...scene.messages],
                    });
                    if (!rows.length)
                      notify("Beginning of conversation reached");
                  } catch (e) {
                    fail(e);
                  }
                }}
              >
                Earlier messages
              </button>
            )}
            <label>
              <Search size={14} />
              <input
                aria-label="Search loaded messages"
                placeholder="Find in conversation"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div
            className="transcript"
            ref={scroll}
            tabIndex={0}
            aria-label="Conversation transcript"
            onWheel={() => {
              manualScrollUntil.current = Date.now() + 1500;
            }}
            onTouchMove={() => {
              manualScrollUntil.current = Date.now() + 1500;
            }}
            onPointerDown={() => {
              manualScrollUntil.current = Date.now() + 1500;
            }}
            onKeyDown={() => {
              manualScrollUntil.current = Date.now() + 1500;
            }}
            onScroll={() => {
              if (scroll.current && Date.now() < manualScrollUntil.current) {
                pinned.current =
                  scroll.current.scrollHeight -
                    scroll.current.scrollTop -
                    scroll.current.clientHeight <
                  100;
                if (pinned.current) setNewCount(0);
              }
            }}
          >
            {!filtered.length && (
              <div className="empty-scene">
                <Compass size={38} />
                <h2>
                  {search ? "No matching messages" : "The room is waiting."}
                </h2>
                <p>
                  {search
                    ? "Try another name or phrase."
                    : "Resume the session to let the characters speak, or add a voice of your own."}
                </p>
              </div>
            )}
            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((v) => {
                const m = filtered[v.index];
                return (
                  <div
                    key={v.key}
                    data-index={v.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${v.start}px)`,
                    }}
                  >
                    <article
                      className="message"
                      id={"message-" + m.id}
                      key={m.id}
                    >
                      <button
                        className={"avatar " + color(m.name)}
                        onClick={() => {
                          const c = scene.characters.find(
                            (c: Data) => c.id === m.author_id,
                          );
                          if (c) setEdit({ ...c });
                        }}
                      >
                        {initials(m.name)}
                      </button>
                      <div className="message-content">
                        <div className="message-header">
                          <strong>{m.name}</strong>
                          <time>{stamp(m.at)}</time>
                          <span className="message-number">#{m.id}</span>
                          {m.parts > 1 && (
                            <small>
                              {m.part + 1}/{m.parts}
                            </small>
                          )}
                          <button
                            className="reply-link"
                            onClick={() => setReply(m)}
                          >
                            Reply
                          </button>
                        </div>
                        {m.reply_to && (
                          <button
                            className="reply-ref"
                            onClick={() => focus(m.reply_to)}
                          >
                            Replying to #{m.reply_to}
                          </button>
                        )}
                        {m.addressees?.[0] !== "everyone" && (
                          <div className="address">
                            To{" "}
                            {m.addressees
                              .map(
                                (a: string) =>
                                  scene.characters.find((c: Data) => c.id === a)
                                    ?.name || a,
                              )
                              .join(", ")}{" "}
                            · audible to everyone
                          </div>
                        )}
                        <p>{m.text}</p>
                        {scene.settings.show_reasoning_in_chat &&
                          !m.request_id.startsWith("operator-") && (
                            <button
                              className="text-button quiet"
                              onClick={() => {
                                setDiagnostics(true);
                                setTab("Reasoning");
                                setReqId(m.request_id);
                              }}
                            >
                              Inspect provider reasoning
                            </button>
                          )}
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          </div>
          {newCount > 0 && (
            <button
              className="jump"
              onClick={() => {
                pinned.current = true;
                setNewCount(0);
                virtualizer.scrollToIndex(filtered.length - 1, {
                  align: "end",
                });
              }}
            >
              {newCount} new messages
              <ChevronDown size={14} />
            </button>
          )}
          <div className="composer">
            {reply && (
              <div className="replying">
                Replying to {reply.name} · #{reply.id}
                <button className="icon" onClick={() => setReply(null)}>
                  <X size={13} />
                </button>
              </div>
            )}
            <div className="composer-options">
              <label>
                Speak as
                <select
                  aria-label="Participation identity"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                >
                  <optgroup label="Ambient voices">
                    {scene.scenario.ambient_voices.map((v: string) => (
                      <option value={"ambient:" + v} key={v}>
                        {v}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Characters">
                    {scene.characters.map((c: Data) => (
                      <option value={"character:" + c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <option value="custom">Another named voice...</option>
                </select>
              </label>
              <label>
                Address
                <select
                  aria-label="Message addressee"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="everyone">Everyone</option>
                  {scene.characters.map((c: Data) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {identity === "custom" && (
              <input
                aria-label="Custom voice name"
                placeholder="Name of the voice"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            )}
            <div className="compose-input">
              <textarea
                aria-label="Your contribution"
                placeholder="A voice from within the world..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button
                className="send"
                aria-label="Send contribution"
                disabled={sending || !text.trim()}
                onClick={send}
              >
                <Send size={18} />
              </button>
            </div>
            <small>
              Your external identity is never included in the characters'
              context.
            </small>
          </div>
        </section>
        {diagnostics && (
          <aside className="diagnostics">
            <div className="row between">
              <h3>
                <Activity size={16} />
                Diagnostics
              </h3>
              <button
                className="icon"
                aria-label="Close diagnostics"
                onClick={() => setDiagnostics(false)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="tabs">
              {["Status", "Requests", "Reasoning", "Logs"].map((t) => (
                <button
                  className={tab === t ? "selected" : ""}
                  onClick={() => setTab(t)}
                  key={t}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="diagnostic-body">
              {tab === "Status" ? (
                <>
                  <div className="stats">
                    <div>
                      <strong>{active.length}</strong>
                      <span>In flight</span>
                    </div>
                    <div>
                      <strong>{seconds(latency) || "0 s"}</strong>
                      <span>Mean latency</span>
                    </div>
                    <div>
                      <strong>{failures.length}</strong>
                      <span>Recent errors</span>
                    </div>
                  </div>
                  <h4>REQUEST LATENCY</h4>
                  <Sparkline
                    values={complete
                      .slice(0, 40)
                      .reverse()
                      .map((r) => r.metrics.duration_ms)}
                  />
                  <p className="quiet tiny">
                    Most recent completed requests · {complete.length} samples
                  </p>
                  <h4>RECENT REQUEST OUTCOMES</h4>
                  <div className="outcome-chart">
                    {requests
                      .slice(0, 45)
                      .reverse()
                      .map((r) => (
                        <span
                          key={r.id}
                          className={
                            r.status === "error"
                              ? "failed"
                              : r.metrics.attempt > 1
                                ? "retried"
                                : "healthy"
                          }
                          title={`${r.status} · ${r.metrics.failure_kind || "no failure"}`}
                        />
                      ))}
                  </div>
                  <p className="quiet tiny">
                    {
                      requests.filter(
                        (r) => r.metrics.failure_kind === "timeout",
                      ).length
                    }{" "}
                    timeouts ·{" "}
                    {
                      requests.filter((r) => r.metrics.http_status === 429)
                        .length
                    }{" "}
                    throttled ·{" "}
                    {requests.filter((r) => r.metrics.attempt > 1).length}{" "}
                    retried
                  </p>
                  <h4>CONTEXT PRESSURE</h4>
                  {scene.characters.map((c: Data) => {
                    const r = requests.find(
                      (r) => r.character_id === c.id && r.kind === "character",
                    );
                    const pct = r
                      ? Math.min(
                          100,
                          (r.metrics.estimated_input_tokens /
                            r.metrics.context_capacity) *
                            100,
                        )
                      : 0;
                    return (
                      <div className="context-meter" key={c.id}>
                        <div className="row between">
                          <strong>{c.name}</strong>
                          <span>{pct.toFixed(1)}%</span>
                        </div>
                        <div className="track">
                          <i style={{ width: `${Math.max(0.4, pct)}%` }} />
                        </div>
                        <small>
                          {r
                            ? `${fmt(r.metrics.estimated_input_tokens)} / ${fmt(r.metrics.context_capacity)} tokens estimated`
                            : "No request yet"}
                        </small>
                      </div>
                    );
                  })}
                  <div className="info-box">
                    Compaction at{" "}
                    {Math.round(scene.settings.compact_ratio * 100)}%. Context
                    figures are estimates; actual provider usage appears in each
                    request.
                  </div>
                </>
              ) : tab === "Logs" ? (
                <>
                  <div className="filter-row">
                    <select
                      aria-label="Log level"
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                    >
                      <option value="">All levels</option>
                      {["DEBUG", "INFO", "WARNING", "ERROR"].map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Log character"
                      value={charFilter}
                      onChange={(e) => setCharFilter(e.target.value)}
                    >
                      <option value="">All characters</option>
                      {scene.characters.map((c: Data) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {logs
                    .filter(
                      (l) =>
                        (!level || l.level === level) &&
                        (!charFilter || l.character_id === charFilter),
                    )
                    .map((l) => (
                      <div className="log" key={l.id}>
                        <span className={"severity " + l.level}>{l.level}</span>
                        <time>{stamp(l.at)}</time>
                        <p>{l.message}</p>
                        {l.character_id && (
                          <small>{charName(l.character_id)}</small>
                        )}
                      </div>
                    ))}
                  {!logs.length && (
                    <p className="quiet">Engine events will appear here.</p>
                  )}
                </>
              ) : (
                <>
                  <div className="request-list">
                    {requests.map((r) => (
                      <button
                        className={`request-row ${reqId === r.id ? "chosen" : ""}`}
                        key={r.id}
                        onClick={() => setReqId(r.id)}
                      >
                        <span>
                          <strong>{charName(r.character_id)}</strong>
                          <small>
                            {r.kind} · {stamp(r.created)}
                          </small>
                        </span>
                        <span>
                          <Badge value={r.status} />
                          <small>{seconds(r.metrics.duration_ms)}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  {detail ? (
                    <div className="request-detail">
                      <h4>
                        {charName(detail.character_id)} · {detail.kind}
                      </h4>
                      <dl>
                        <dt>Status</dt>
                        <dd>{detail.status}</dd>
                        <dt>Model</dt>
                        <dd>{detail.metrics.model}</dd>
                        <dt>Observation cutoff</dt>
                        <dd>#{detail.cutoff}</dd>
                        <dt>Reasoning effort</dt>
                        <dd>
                          {detail.metrics.reasoning_effort ||
                            "Provider default"}
                        </dd>
                        <dt>Queue delay</dt>
                        <dd>{seconds(detail.metrics.queue_ms)}</dd>
                        <dt>First token</dt>
                        <dd>{seconds(detail.metrics.first_token_ms)}</dd>
                        <dt>Reasoning phase</dt>
                        <dd>{seconds(detail.metrics.reasoning_ms)}</dd>
                        <dt>Total duration</dt>
                        <dd>{seconds(detail.metrics.duration_ms)}</dd>
                        <dt>HTTP status / failure</dt>
                        <dd>
                          {detail.metrics.http_status || "OK"}{" "}
                          {detail.metrics.failure_kind || ""}
                        </dd>
                        <dt>Input / output tokens</dt>
                        <dd>
                          {fmt(detail.metrics.usage?.input_tokens)} /{" "}
                          {fmt(detail.metrics.usage?.output_tokens)}
                        </dd>
                        <dt>Finish reason</dt>
                        <dd>{detail.metrics.finish_reason || "Pending"}</dd>
                        <dt>Attempt</dt>
                        <dd>{detail.metrics.attempt || 1}</dd>
                      </dl>
                      {detail.error && (
                        <p className="error-text">{detail.error}</p>
                      )}
                      <h4>PROVIDER REASONING</h4>
                      {detail.metrics.reasoning_truncated && (
                        <p className="quiet tiny">
                          Captured reasoning reached its storage limit.
                        </p>
                      )}
                      <pre className="reasoning">
                        {detail.reasoning ||
                          (!scene.settings.capture_reasoning
                            ? "Reasoning capture is off. Enable it in Settings."
                            : "No reasoning text was exposed for this request.")}
                      </pre>
                    </div>
                  ) : (
                    <p className="quiet">
                      Select a request to inspect its timing, usage, and
                      reasoning.
                    </p>
                  )}
                </>
              )}
            </div>
          </aside>
        )}
      </div>
      {sceneConfig && (
        <Modal
          title="Scene settings"
          subtitle="Changes apply to this world. Resuming after a save preserves these values."
          onClose={() => setSceneConfig(null)}
        >
          <div className="form-grid">
            {[
              ["cooldown", "Character cooldown"],
              ["global_gap", "Global delivery gap"],
              ["word_limit", "Words per part"],
              ["max_parts", "Maximum speech parts"],
              ["working_context", "Working context ceiling"],
              ["narrator_interval", "Narrator interval"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type="number"
                  step={
                    key === "cooldown" || key === "global_gap" ? "0.5" : "1"
                  }
                  value={sceneConfig[key]}
                  onChange={(e) =>
                    setSceneConfig({
                      ...sceneConfig,
                      [key]: Number(e.target.value),
                    })
                  }
                />
              </Field>
            ))}
          </div>
          <Field label="Compaction threshold (%)">
            <input
              type="number"
              min="15"
              max="95"
              value={Math.round(sceneConfig.compact_ratio * 100)}
              onChange={(e) =>
                setSceneConfig({
                  ...sceneConfig,
                  compact_ratio: Number(e.target.value) / 100,
                })
              }
            />
          </Field>
          <div className="actions">
            <Button
              onClick={async () => {
                try {
                  await api(`/sessions/${id}/config`, "PUT", {});
                  setSceneConfig(null);
                  await load();
                  notify("Global defaults restored");
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Use global defaults
            </Button>
            <Button
              primary
              onClick={async () => {
                try {
                  await api(`/sessions/${id}/config`, "PUT", sceneConfig);
                  setSceneConfig(null);
                  await load();
                  notify("Scene settings saved");
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Save for this scene
            </Button>
          </div>
        </Modal>
      )}
      {castOpen && (
        <Modal title="People in this scene" onClose={() => setCastOpen(false)}>
          <Button
            onClick={() => {
              setCastOpen(false);
              newCharacter();
            }}
          >
            <Plus size={14} />
            Add character
          </Button>
          {scene.characters.map((c: Data) => (
            <button
              className="character-row"
              key={c.id}
              onClick={() => {
                setCastOpen(false);
                setEdit({ ...c });
              }}
            >
              <span className={"avatar " + color(c.name)}>
                {initials(c.name)}
              </span>
              <span>
                <strong>{c.name}</strong>
                <small>{c.role}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </Modal>
      )}
      {edit && (
        <Modal
          title={edit.id === "new" ? "A new person enters" : edit.name}
          subtitle="Identity, private background, and first-person memory."
          onClose={() => setEdit(null)}
          wide
        >
          <div className="form-grid">
            <Field label="Name">
              <input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </Field>
            <Field label="Public role">
              <input
                value={edit.role}
                onChange={(e) => setEdit({ ...edit, role: e.target.value })}
              />
            </Field>
            <Field label="Provider">
              <select
                value={edit.provider_id}
                onChange={(e) =>
                  setEdit({ ...edit, provider_id: e.target.value })
                }
              >
                {boot.providers.map((p: Data) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Cooldown in seconds"
              hint="Blank uses the session default."
            >
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={edit.cooldown ?? ""}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    cooldown: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </Field>
          </div>
          <Field label="Copy a reusable persona">
            <select
              value={edit.persona_id}
              onChange={(e) =>
                setEdit({
                  ...edit,
                  persona_id: e.target.value,
                  persona:
                    boot.personas.find((p: Data) => p.id === e.target.value)
                      ?.prompt || edit.persona,
                })
              }
            >
              <option value="">Custom personality</option>
              {boot.personas.map((p: Data) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Personality, in this character's own words">
            <textarea
              rows={4}
              value={edit.persona}
              onChange={(e) => setEdit({ ...edit, persona: e.target.value })}
            />
          </Field>
          <Field label="Private background">
            <textarea
              rows={3}
              value={edit.background}
              onChange={(e) => setEdit({ ...edit, background: e.target.value })}
            />
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={edit.muted || false}
              onChange={(e) => setEdit({ ...edit, muted: e.target.checked })}
            />
            Keep this character quiet. Regular observation continues.
          </label>
          <div className="memory-box">
            <h3>My recollections</h3>
            <p>
              {edit.memory ||
                "No compacted memory yet. Recent observations remain in the context tail."}
            </p>
            <small>
              {edit.memory_checkpoints} checkpoints · observed through #
              {edit.observed} · memory covers through #{edit.memory_cutoff}
            </small>
          </div>
          <div className="actions">
            <Button
              disabled={scene.status === "running" || edit.id === "new"}
              title="Pause before manually compacting"
              onClick={async () => {
                try {
                  await api(
                    `/sessions/${id}/characters/${edit.id}/compact`,
                    "POST",
                  );
                  await load();
                  notify("Memory checkpoint saved");
                  setEdit(null);
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Compact now
            </Button>
            <Button
              primary
              disabled={!edit.name}
              onClick={async () => {
                try {
                  await api(
                    `/sessions/${id}/characters${edit.id === "new" ? "" : "/" + edit.id}`,
                    edit.id === "new" ? "POST" : "PUT",
                    edit,
                  );
                  setEdit(null);
                  await load();
                  notify("Character updated");
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Save character
            </Button>
          </div>
        </Modal>
      )}
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
      {saveOpen && (
        <Modal
          title="Save this world"
          subtitle="History, character memories, and settings. Credentials stay on this machine."
          onClose={() => setSaveOpen(false)}
        >
          <div className="inline">
            <input
              aria-label="Checkpoint name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
            <Button
              primary
              onClick={async () => {
                try {
                  await api(`/sessions/${id}/saves`, "POST", {
                    name: saveName,
                  });
                  setSaves(await api(`/sessions/${id}/saves`));
                  notify("Checkpoint saved");
                } catch (e) {
                  fail(e);
                }
              }}
            >
              <Save size={16} />
              Save
            </Button>
          </div>
          <div className="info-box">
            Loading a checkpoint opens a restored copy, paused. This session is
            preserved.
          </div>
          {saves.map((s) => (
            <div className="save-row" key={s.id}>
              <span>
                <strong>{s.name}</strong>
                <small>{date(s.created)}</small>
              </span>
              <a
                href={"/api/saves/" + s.id}
                download
                className="icon"
                title="Download save"
              >
                <Download size={17} />
              </a>
              <Button
                onClick={async () => {
                  try {
                    const result = await api(`/saves/${s.id}/load`, "POST");
                    setSaveOpen(false);
                    await refresh();
                    go("/scene/" + result.id);
                  } catch (e) {
                    fail(e);
                  }
                }}
              >
                Load
              </Button>
            </div>
          ))}
          <label className="button import-button">
            <Upload size={16} />
            Import a saved world
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const result = await api(
                    "/saves/import",
                    "POST",
                    JSON.parse(await f.text()),
                  );
                  setSaveOpen(false);
                  await refresh();
                  go("/scene/" + result.id);
                } catch (error) {
                  fail(error);
                }
              }}
            />
          </label>
        </Modal>
      )}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="chart">
      {values.length > 1 ? (
        <svg
          viewBox="0 0 300 80"
          role="img"
          aria-label="Recent request latency"
        >
          <path
            d="M0 75 H300 M0 40 H300 M0 5 H300"
            stroke="var(--line)"
            strokeDasharray="3 5"
          />
          <polyline
            points={values
              .map(
                (v, i) =>
                  `${(i / (values.length - 1)) * 300},${75 - (v / max) * 65}`,
              )
              .join(" ")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
          />
        </svg>
      ) : (
        <span>Latency history appears after requests complete.</span>
      )}
    </div>
  );
}

function Personas({ boot, refresh, fail, notify }: any) {
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
function PageHeading({ eyebrow, title, description, action }: any) {
  return (
    <>
      <div className="eyebrow">{eyebrow}</div>
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action}
      </div>
    </>
  );
}

function Scenarios({ boot, refresh, fail, notify, onCreateSession }: any) {
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

function Providers({ boot, refresh, fail, notify }: any) {
  const [edit, setEdit] = useState<Data | null>(null);
  const field = (key: string, value: any) =>
    setEdit((e: Data | null) => ({ ...e, [key]: value }));
  return (
    <div className="page">
      <PageHeading
        eyebrow="MODEL CONNECTIONS"
        title="One world. Any capable model."
        description="Provider details stay separate from characters, scenes, and memory."
        action={
          <Button
            primary
            onClick={() =>
              setEdit({
                id: crypto.randomUUID(),
                name: "",
                protocol: "openai",
                base_url: "http://localhost:11434/v1",
                model: "",
                key_env: "",
                context_tokens: 32768,
                max_output: 4096,
                requires_key: false,
                reasoning_effort: "auto",
                supports_effort: false,
                timeout: 90,
                concurrency: 4,
              })
            }
          >
            <Plus size={17} />
            Add provider
          </Button>
        }
      />
      <div className="entity-grid">
        {boot.providers.map((p: Data) => (
          <article className="entity-card" key={p.id}>
            <div className="row between">
              <Plug size={24} />
              <Badge value={p.configured ? "configured" : "needs_key"} />
            </div>
            <h2>{p.name}</h2>
            <p className="model-name">{p.model}</p>
            <dl>
              <dt>Protocol</dt>
              <dd>
                {p.protocol === "openai" ? "OpenAI-compatible" : p.protocol}
              </dd>
              <dt>Context</dt>
              <dd>{fmt(p.context_tokens)} tokens</dd>
              <dt>Reasoning</dt>
              <dd>
                {p.supports_effort ? p.reasoning_effort : "Provider default"}
              </dd>
              <dt>Concurrency</dt>
              <dd>{p.concurrency} requests</dd>
            </dl>
            <Button onClick={() => setEdit({ ...p, api_key: "" })}>
              Configure
              <SlidersHorizontal size={15} />
            </Button>
          </article>
        ))}
      </div>
      {edit && (
        <Modal
          title="Provider settings"
          subtitle="Credentials remain local and never appear in character context or save files."
          wide
          onClose={() => setEdit(null)}
        >
          <div className="form-grid">
            <Field label="Display name">
              <input
                value={edit.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </Field>
            <Field label="Protocol">
              <select
                value={edit.protocol}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    protocol: e.target.value,
                    ...(e.target.value === "ollama"
                      ? {
                          base_url: "http://localhost:11434",
                          requires_key: false,
                          supports_effort: false,
                        }
                      : {}),
                  })
                }
              >
                <option value="openai">OpenAI-compatible</option>
                <option value="ollama">Ollama native</option>
                <option value="mock">Mock laboratory</option>
              </select>
            </Field>
            <Field label="Base URL">
              <input
                value={edit.base_url}
                onChange={(e) => field("base_url", e.target.value)}
              />
            </Field>
            <Field label="Model ID">
              <input
                value={edit.model}
                onChange={(e) => field("model", e.target.value)}
              />
            </Field>
            <Field
              label="API key"
              hint={
                edit.configured
                  ? "A credential is already available. Leave blank to keep it."
                  : "Optional for a local server."
              }
            >
              <input
                type="password"
                autoComplete="off"
                value={edit.api_key || ""}
                onChange={(e) => field("api_key", e.target.value)}
              />
            </Field>
            <Field
              label="Credential environment variable"
              hint="AUTO uses the existing local key for the default GLM profile."
            >
              <input
                value={edit.key_env}
                onChange={(e) => field("key_env", e.target.value)}
              />
            </Field>
            {[
              ["context_tokens", "Context capacity"],
              ["max_output", "Output allowance, including reasoning"],
              ["timeout", "Request timeout in seconds"],
              ["concurrency", "Provider concurrency"],
            ].map(([key, label]) => (
              <Field label={label} key={key}>
                <input
                  type="number"
                  value={edit[key]}
                  onChange={(e) => field(key, Number(e.target.value))}
                />
              </Field>
            ))}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={edit.requires_key ?? true}
              onChange={(e) => field("requires_key", e.target.checked)}
            />
            Require an API credential for this endpoint
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={edit.supports_effort}
              onChange={(e) => field("supports_effort", e.target.checked)}
            />
            Send a supported reasoning effort parameter
          </label>
          {edit.supports_effort && (
            <Field label="Reasoning effort">
              <select
                value={edit.reasoning_effort}
                onChange={(e) => field("reasoning_effort", e.target.value)}
              >
                {["auto", "low", "high", "max"].map((x) => (
                  <option key={x} value={x}>
                    {x === "auto"
                      ? "Auto (provider default)"
                      : x[0].toUpperCase() + x.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="actions">
            <Button
              primary
              disabled={!edit.name || !edit.model}
              onClick={async () => {
                try {
                  await api("/providers/" + edit.id, "PUT", edit);
                  setEdit(null);
                  await refresh();
                  notify("Provider saved");
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Save provider
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Preferences({ boot, refresh, fail, notify }: any) {
  const [form, setForm] = useState<Data>(structuredClone(boot.settings)),
    [tab, setTab] = useState("Runtime");
  const set = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));
  return (
    <div className="page settings-page">
      <PageHeading
        eyebrow="MAKE IT YOURS"
        title="The rules around the world."
        description="Global defaults apply to existing sessions unless a session has its own override."
        action={
          <Button
            primary
            onClick={async () => {
              try {
                await api("/settings", "PUT", form);
                await refresh();
                notify("Settings saved");
              } catch (e) {
                fail(e);
              }
            }}
          >
            <Save size={16} />
            Save settings
          </Button>
        }
      />
      <div className="tabs large">
        {["Runtime", "Memory", "Narrator", "Diagnostics", "Prompts"].map(
          (t) => (
            <button
              key={t}
              className={tab === t ? "selected" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ),
        )}
      </div>
      <section className="settings-content">
        {tab === "Runtime" ? (
          <>
            <h2>A rhythm for the gathering</h2>
            <p>
              Each cooldown sends the current board tail and that character's
              memory. The model may speak or return no response.
            </p>
            <div className="form-grid">
              {[
                [
                  "cooldown",
                  "Default character cooldown",
                  "Seconds after a completed request.",
                ],
                [
                  "global_gap",
                  "Global message gap",
                  "Minimum seconds between delivered speech parts.",
                ],
                [
                  "max_concurrency",
                  "Total request concurrency",
                  "Shared by dialogue, memory, and narration.",
                ],
                [
                  "character_slots",
                  "Character request slots",
                  "Leave room for maintenance requests.",
                ],
                [
                  "word_limit",
                  "Words per message part",
                  "Long speech is split mechanically.",
                ],
                [
                  "max_parts",
                  "Maximum parts per utterance",
                  "Bounds the delivery queue.",
                ],
              ].map(([key, label, hint]) => (
                <Field label={label} hint={hint} key={key}>
                  <input
                    type="number"
                    step={
                      key.includes("cooldown") || key === "global_gap"
                        ? "0.5"
                        : "1"
                    }
                    value={form[key]}
                    onChange={(e) => set(key, Number(e.target.value))}
                  />
                </Field>
              ))}
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={form.auto_resume}
                onChange={(e) => set("auto_resume", e.target.checked)}
              />
              Automatically resume running worlds after a backend restart
            </label>
            <p className="quiet">
              By default, a backend restart restores worlds paused. Closing the
              browser or navigating away never pauses a running session.
            </p>
          </>
        ) : tab === "Memory" ? (
          <>
            <h2>Keep the person, not every word.</h2>
            <p>
              The full transcript remains on disk. Each character retains a
              private first-person memory and a recent observation tail.
            </p>
            <div className="form-grid">
              <Field label="Compaction threshold (%)">
                <input
                  type="number"
                  min="15"
                  max="95"
                  value={Math.round(form.compact_ratio * 100)}
                  onChange={(e) =>
                    set("compact_ratio", Number(e.target.value) / 100)
                  }
                />
              </Field>
              <Field label="Memory target in words">
                <input
                  type="number"
                  value={form.memory_words}
                  onChange={(e) => set("memory_words", Number(e.target.value))}
                />
              </Field>
              <Field
                label="Working context ceiling"
                hint="0 uses the provider's configured full context capacity."
              >
                <input
                  type="number"
                  value={form.working_context}
                  onChange={(e) =>
                    set("working_context", Number(e.target.value))
                  }
                />
              </Field>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={form.include_model_time}
                onChange={(e) => set("include_model_time", e.target.checked)}
              />
              Include a 24-hour clock in model-visible observations
            </label>
            <Field label="Model time zone">
              <input
                value={form.timezone}
                onChange={(e) => set("timezone", e.target.value)}
              />
            </Field>
            <div className="info-box">
              Checkpoint files live under
              data/sessions/[session]/characters/[character]/. Failed compaction
              keeps the prior valid memory.
            </div>
          </>
        ) : tab === "Narrator" ? (
          <>
            <h2>A chronicle of what you missed.</h2>
            <p>
              The narrator observes. Its reports never become dialogue or
              character memory.
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={form.narrator_enabled}
                onChange={(e) => set("narrator_enabled", e.target.checked)}
              />
              Prepare periodic recaps while sessions run
            </label>
            <div className="form-grid">
              <Field label="Interval in seconds">
                <input
                  type="number"
                  min="30"
                  value={form.narrator_interval}
                  onChange={(e) =>
                    set("narrator_interval", Number(e.target.value))
                  }
                />
              </Field>
              <Field label="Narrator provider">
                <select
                  value={form.narrator_provider}
                  onChange={(e) => set("narrator_provider", e.target.value)}
                >
                  {boot.providers.map((p: Data) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Default narrator access">
                <select
                  value={form.narrator_scope}
                  onChange={(e) => set("narrator_scope", e.target.value)}
                >
                  <option value="public">Public history only</option>
                  <option value="private">
                    Include private memories and reasoning
                  </option>
                </select>
              </Field>
            </div>
            <p className="quiet">
              Notable moments are the narrator's interpretations, linked to
              source messages. Quiet intervals do not need invented events.
            </p>
          </>
        ) : tab === "Diagnostics" ? (
          <>
            <h2>See the machinery when you need it.</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={form.capture_reasoning}
                onChange={(e) => set("capture_reasoning", e.target.checked)}
              />
              Capture provider-returned reasoning for the private inspector
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.show_reasoning_in_chat}
                onChange={(e) =>
                  set("show_reasoning_in_chat", e.target.checked)
                }
              />
              Show reasoning-inspector links alongside dialogue
            </label>
            <Field label="Reasoning storage limit per request, in characters">
              <input
                type="number"
                value={form.reasoning_limit}
                onChange={(e) => set("reasoning_limit", Number(e.target.value))}
              />
            </Field>
            <div className="info-box">
              Reasoning effort belongs to each provider profile. Hiding
              reasoning does not reduce inference effort. Estimates and reported
              token usage are labeled separately.
            </div>
          </>
        ) : (
          <>
            <h2>Editable instructions</h2>
            <Field label="Global speech rules">
              <textarea
                className="prompt-editor"
                rows={5}
                value={form.speech_rules || ""}
                onChange={(e) => set("speech_rules", e.target.value)}
              />
            </Field>
            <p>
              Applies to every character on its next generation, across all
              providers and worlds, including loaded saves. This controls spoken
              text, not JSON syntax, private memories, or narrator reports.
              Scene overrides cannot replace these rules.
            </p>
            <p>
              Character instructions can use {"{name}"} and {"{word_limit}"}.
              Memory instructions can use {"{target_words}"}. Public dialogue is
              always treated as data.
            </p>
            {[
              ["character_prompt", "Character behavior"],
              ["memory_prompt", "First-person memory compaction"],
              ["narrator_prompt", "Narrator style and notable moments"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <textarea
                  className="prompt-editor"
                  rows={10}
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              </Field>
            ))}
          </>
        )}
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
