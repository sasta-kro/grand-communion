import { Save } from "lucide-react";
import { useState } from "react";
import { Button, PageHeading } from "../../components/ui";
import { tr, type MessageKey } from "../../i18n";
import { api } from "../../lib/api";
import { Data, PageProps } from "../../lib/types";
import { DiagnosticsSettings } from "./DiagnosticsSettings";
import { InterfaceSettings } from "./InterfaceSettings";
import { MemorySettings } from "./MemorySettings";
import { NarratorSettings } from "./NarratorSettings";
import { PromptSettings } from "./PromptSettings";
import { RuntimeSettings } from "./RuntimeSettings";

export function Preferences({ boot, refresh, fail, notify }: PageProps) {
  const [form, setForm] = useState<Data>(structuredClone(boot.settings)),
    [tab, setTab] = useState("Runtime");
  const tabKeys: Record<string, MessageKey> = {
    Runtime: "settings.tab.runtime",
    Memory: "settings.tab.memory",
    Narrator: "settings.tab.narrator",
    Diagnostics: "settings.tab.diagnostics",
    Prompts: "settings.tab.prompts",
    Interface: "settings.tab.interface",
  };
  const set = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));
  return (
    <div className="page settings-page">
      <PageHeading
        eyebrow=""
        title={tr("navigation.settings")}
        description={tr(
          "settings.globalDefaultsApplyToExistingSessionsUnlessA",
        )}
        action={
          <Button
            primary
            onClick={async () => {
              try {
                await api("/settings", "PUT", form);
                await refresh();
                notify(tr("settings.settingsSaved"));
              } catch (e) {
                fail(e);
              }
            }}
          >
            <Save size={16} />
            {tr("settings.saveSettings")}
          </Button>
        }
      />
      <div className="tabs large">
        {[
          "Runtime",
          "Memory",
          "Narrator",
          "Diagnostics",
          "Prompts",
          "Interface",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {tr(tabKeys[t])}
          </button>
        ))}
      </div>
      <section className="settings-content">
        {tab === "Interface" ? (
          <InterfaceSettings />
        ) : tab === "Runtime" ? (
          <RuntimeSettings boot={boot} form={form} set={set} />
        ) : tab === "Memory" ? (
          <MemorySettings boot={boot} form={form} set={set} />
        ) : tab === "Narrator" ? (
          <NarratorSettings boot={boot} form={form} set={set} />
        ) : tab === "Diagnostics" ? (
          <DiagnosticsSettings boot={boot} form={form} set={set} />
        ) : (
          <PromptSettings boot={boot} form={form} set={set} />
        )}
      </section>
    </div>
  );
}
