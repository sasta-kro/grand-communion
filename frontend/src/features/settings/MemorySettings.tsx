import { Field } from "../../components/ui";
import type { SettingsSectionProps } from "./types";
export function MemorySettings({ form, set }: SettingsSectionProps) {
  return (
    <>
      <h2>Context and memory</h2>
      <p>
        The full transcript remains on disk. Each character retains a private
        first-person memory and a recent observation tail.
      </p>
      <div className="form-grid">
        <Field label="Compaction threshold (%)">
          <input
            type="number"
            min="15"
            max="95"
            value={Math.round(form.compact_ratio * 100)}
            onChange={(e) => set("compact_ratio", Number(e.target.value) / 100)}
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
            onChange={(e) => set("working_context", Number(e.target.value))}
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
        data/sessions/[session]/characters/[character]/. Failed compaction keeps
        the prior valid memory.
      </div>
    </>
  );
}
