import { Check, Compass, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AppNavigation } from "./components/AppNavigation";
import { Button } from "./components/ui";
import { Personas } from "./features/personas/PersonasPage";
import { Providers } from "./features/providers/ProvidersPage";
import { Scenarios } from "./features/scenarios/ScenariosPage";
import { Scene } from "./features/scene/ScenePage";
import { NewSessionDialog } from "./features/sessions/NewSessionDialog";
import { SessionsPage } from "./features/sessions/SessionsPage";
import { Preferences } from "./features/settings/SettingsPage";
import { api } from "./lib/api";
import { BootstrapData, Data } from "./lib/types";

export function App() {
  const [boot, setBoot] = useState<BootstrapData | null>(null),
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
  const fail = (error: unknown) =>
    setError(error instanceof Error ? error.message : String(error));
  const refresh = async () => {
    try {
      setBoot(await api<BootstrapData>("/bootstrap"));
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
      <AppNavigation boot={boot} section={section} active={active} />
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
