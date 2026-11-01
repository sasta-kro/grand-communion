import { Save } from "lucide-react";
import { useState } from "react";
import { Button, PageHeading } from "../../components/ui";
import { api } from "../../lib/api";
import { Data, PageProps } from "../../lib/types";
import { DiagnosticsSettings } from "./DiagnosticsSettings";
import { MemorySettings } from "./MemorySettings";
import { NarratorSettings } from "./NarratorSettings";
import { PromptSettings } from "./PromptSettings";
import { RuntimeSettings } from "./RuntimeSettings";

export function Preferences({ boot, refresh, fail, notify }: PageProps) {
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
