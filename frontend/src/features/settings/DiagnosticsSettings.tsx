import { Field } from "../../components/ui";
import type { SettingsSectionProps } from "./types";
export function DiagnosticsSettings({ form, set }: SettingsSectionProps) {
  return (
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
          onChange={(e) => set("show_reasoning_in_chat", e.target.checked)}
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
        Reasoning effort belongs to each provider profile. Hiding reasoning does
        not reduce inference effort. Estimates and reported token usage are
        labeled separately.
      </div>
    </>
  );
}
