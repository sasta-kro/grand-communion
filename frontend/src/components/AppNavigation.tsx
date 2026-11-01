import type { BootstrapData } from "../lib/types";
import { Icon, type IconName } from "./Icon";

export function AppNavigation({
  boot,
  section,
  active,
}: {
  boot: BootstrapData;
  section: string;
  active: number;
}) {
  const lastSession = localStorage.getItem("communion:lastSession");
  const links: {
    section: string;
    label: string;
    icon: IconName;
    href: string;
  }[] = [
    {
      section: "sessions",
      label: "Sessions",
      icon: "sessions",
      href: "#/sessions",
    },
    {
      section: "scene",
      label: "Chat",
      icon: "chat",
      href: lastSession ? `#/scene/${lastSession}` : "#/sessions",
    },
    {
      section: "scenarios",
      label: "Scenarios",
      icon: "scenarios",
      href: "#/scenarios",
    },
    {
      section: "personas",
      label: "Personas",
      icon: "personas",
      href: "#/personas",
    },
    {
      section: "providers",
      label: "Providers",
      icon: "providers",
      href: "#/providers",
    },
    {
      section: "settings",
      label: "Settings",
      icon: "settings",
      href: "#/settings",
    },
  ];
  return (
    <aside className="sidebar">
      <a className="brand" href="#/sessions">
        <Icon name="chat" size={29} />
        <span>Communion</span>
      </a>
      <nav aria-label="Main navigation">
        {links.map((link) => (
          <a
            key={link.section}
            href={link.href}
            className={section === link.section ? "selected" : ""}
            aria-current={section === link.section ? "page" : undefined}
          >
            <Icon name={link.icon} size={24} />
            {link.label}
            {link.section === "sessions" && (
              <span>{boot.sessions.length || ""}</span>
            )}
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span className={`dot ${active ? "live" : ""}`} />
        <div>
          {active
            ? `${active} ${active === 1 ? "session" : "sessions"} running`
            : "No sessions running"}
        </div>
      </div>
    </aside>
  );
}
