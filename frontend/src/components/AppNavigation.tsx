import {
  BookOpen,
  Compass,
  Layers,
  MessagesSquare,
  Plug,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";
import { BootstrapData } from "../lib/types";

export function AppNavigation({
  boot,
  section,
  active,
}: {
  boot: BootstrapData;
  section: string;
  active: number;
}) {
  return (
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
  );
}
