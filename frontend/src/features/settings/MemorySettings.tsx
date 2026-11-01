import { Checkbox, Field } from "../../components/ui";
import { tr } from "../../i18n";
import type { SettingsSectionProps } from "./types";
export function MemorySettings({ form, set }: SettingsSectionProps) {
  return (
    <>
      <h2>{tr("settings.memory.contextAndMemory")}</h2>
      <p>{tr("settings.memory.theFullTranscriptRemainsOnDiskEachCharacter")}</p>
      <div className="form-grid">
        <Field label={tr("settings.compactionThreshold")}>
          <input
            type="number"
            min="15"
            max="95"
            value={Math.round(form.compact_ratio * 100)}
            onChange={(e) => set("compact_ratio", Number(e.target.value) / 100)}
          />
        </Field>
        <Field label={tr("settings.memory.memoryTargetInWords")}>
          <input
            type="number"
            value={form.memory_words}
            onChange={(e) => set("memory_words", Number(e.target.value))}
          />
        </Field>
        <Field
          label={tr("settings.workingContextCeiling")}
          hint={tr("settings.memory.0UsesTheProviderSConfiguredFullContext")}
        >
          <input
            type="number"
            value={form.working_context}
            onChange={(e) => set("working_context", Number(e.target.value))}
          />
        </Field>
      </div>
      <Checkbox
        checked={form.include_model_time}
        onChange={(e) => set("include_model_time", e.target.checked)}
        label={tr("settings.memory.includeA24HourClockInModelVisible")}
      />
      <Field label={tr("settings.memory.modelTimeZone")}>
        <input
          value={form.timezone}
          onChange={(e) => set("timezone", e.target.value)}
        />
      </Field>
      <div className="info-box">
        {tr(
          "settings.memory.checkpointFilesLiveUnderDataSessionsSessionCharacters",
        )}
      </div>
    </>
  );
}
