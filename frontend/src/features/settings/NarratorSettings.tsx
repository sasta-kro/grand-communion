import { Checkbox, Field } from "../../components/ui";
import { tr } from "../../i18n";
import { Data } from "../../lib/types";
import type { SettingsSectionProps } from "./types";
export function NarratorSettings({ boot, form, set }: SettingsSectionProps) {
  return (
    <>
      <h2>{tr("settings.narrator.narratorRecaps")}</h2>
      <p>
        {tr(
          "settings.narrator.theNarratorObservesItsReportsNeverBecomeDialogue",
        )}
      </p>
      <Checkbox
        checked={form.narrator_enabled}
        onChange={(e) => set("narrator_enabled", e.target.checked)}
        label={tr("settings.narrator.preparePeriodicRecapsWhileSessionsRun")}
      />
      <div className="form-grid">
        <Field label={tr("settings.narrator.intervalInSeconds")}>
          <input
            type="number"
            min="30"
            value={form.narrator_interval}
            onChange={(e) => set("narrator_interval", Number(e.target.value))}
          />
        </Field>
        <Field label={tr("settings.narrator.narratorProvider")}>
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
        <Field label={tr("settings.narrator.defaultNarratorAccess")}>
          <select
            value={form.narrator_scope}
            onChange={(e) => set("narrator_scope", e.target.value)}
          >
            <option value="public">
              {tr("settings.narrator.publicHistoryOnly")}
            </option>
            <option value="private">
              {tr("recaps.includePrivateMemoriesAndReasoning")}
            </option>
          </select>
        </Field>
      </div>
      <p className="quiet">
        {tr(
          "settings.narrator.notableMomentsAreTheNarratorSInterpretationsLinked",
        )}
      </p>
    </>
  );
}
