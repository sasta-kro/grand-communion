import { Check, Compass, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppNavigation } from "./components/AppNavigation";
import { Button } from "./components/ui";
import { Personas } from "./features/personas/PersonasPage";
import { Providers } from "./features/providers/ProvidersPage";
import { Scenarios } from "./features/scenarios/ScenariosPage";
import { Scene } from "./features/scene/ScenePage";
import { ChatPage } from "./features/sessions/ChatPage";
import { NewSessionDialog } from "./features/sessions/NewSessionDialog";
import { SessionsPage } from "./features/sessions/SessionsPage";
import { Preferences } from "./features/settings/SettingsPage";
import { tr } from "./i18n";
import { api } from "./lib/api";
import { BootstrapData, Data } from "./lib/types";

export function App() {
  useTranslation();
  const [boot, setBoot] = useState<BootstrapData | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [connectionError, setConnectionError] = useState("");
  const [route, setRoute] = useState(location.hash.slice(1) || "/sessions");
  const [create, setCreate] = useState(false),
    [scenario, setScenario] = useState(""),
    [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const notify = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(""), 4000);
  };
  const fail = (error: unknown) => {
    if (error instanceof TypeError)
      setConnectionError(tr("app.cannotReachTheBackendRetryingAutomatically"));
    else setError(error instanceof Error ? error.message : String(error));
  };
  const refresh = async () => {
    try {
      setBoot(await api<BootstrapData>("/bootstrap"));
      setConnectionError("");
    } catch (e) {
      fail(e);
    }
  };
  useEffect(() => {
    refresh();
    const fn = () => {
      setRoute(location.hash.slice(1) || "/sessions");
      setError("");
      refresh();
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
        <h1>{tr("app.communion")}</h1>
        <p>{connectionError || error || tr("app.loadingCommunion")}</p>
        {(error || connectionError) && (
          <Button onClick={refresh}>{tr("common.retry")}</Button>
        )}
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
      <AppNavigation
        boot={boot}
        section={section === "chat" ? "scene" : section}
        active={active}
      />
      <main className={section === "scene" ? "scene-main" : ""}>
        {connectionError && (
          <div className="alert" role="alert">
            {connectionError}
            <Button onClick={refresh}>{tr("app.retryConnection")}</Button>
          </div>
        )}
        {error && (
          <div className="alert" role="alert">
            {error}
            <button
              aria-label={tr("app.dismissError")}
              className="icon"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {section === "chat" ? (
          <ChatPage {...common} newSession={newSession} />
        ) : section === "scene" && sessionId ? (
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
        ) : section !== "sessions" ? (
          <div className="empty-state">
            <h1>{tr("app.pageNotFound")}</h1>
            <p>{tr("app.thisAddressDoesNotMatchACommunionPage")}</p>
            <Button
              onClick={() => {
                location.hash = "/sessions";
              }}
            >
              {tr("app.goToSessions")}
            </Button>
          </div>
        ) : (
          <SessionsPage
            {...common}
            newSession={newSession}
            run={run}
            onSelectScenario={(id) => {
              setScenario(id);
              setCreate(true);
            }}
          />
        )}
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {create && (
        <NewSessionDialog
          {...common}
          scenario={scenario}
          setScenario={setScenario}
          name={name}
          setName={setName}
          busy={busy}
          run={run}
          onClose={() => setCreate(false)}
        />
      )}
    </div>
  );
}
