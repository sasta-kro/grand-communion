import { Field } from "../../components/ui";
import { Data } from "../../lib/types";
import type { SettingsSectionProps } from "./types";
export function NarratorSettings({ boot, form, set }: SettingsSectionProps) {
  return (
    <>
      <h2>Narrator recaps</h2>
      <p>
        The narrator observes. Its reports never become dialogue or character
        memory.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={form.narrator_enabled}
          onChange={(e) => set("narrator_enabled", e.target.checked)}
        />
        Prepare periodic recaps while sessions run
      </label>
      <div className="form-grid">
        <Field label="Interval in seconds">
          <input
            type="number"
            min="30"
            value={form.narrator_interval}
            onChange={(e) => set("narrator_interval", Number(e.target.value))}
          />
        </Field>
        <Field label="Narrator provider">
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
        <Field label="Default narrator access">
          <select
            value={form.narrator_scope}
            onChange={(e) => set("narrator_scope", e.target.value)}
          >
            <option value="public">Public history only</option>
            <option value="private">
              Include private memories and reasoning
            </option>
          </select>
        </Field>
      </div>
      <p className="quiet">
        Notable moments are the narrator's interpretations, linked to source
        messages. Quiet intervals do not need invented events.
      </p>
    </>
  );
}
