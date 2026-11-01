import { Field } from "../../components/ui";
import type { SettingsSectionProps } from "./types";
export function RuntimeSettings({ form, set }: SettingsSectionProps) {
  return (
    <>
      <h2>Timing and concurrency</h2>
      <p>
        Each cooldown sends the current board tail and that character's memory.
        The model may speak or return no response.
      </p>
      <div className="form-grid">
        {[
          [
            "cooldown",
            "Default character cooldown",
            "Seconds after a completed request.",
          ],
          [
            "global_gap",
            "Global message gap",
            "Minimum seconds between delivered speech parts.",
          ],
          [
            "max_concurrency",
            "Total request concurrency",
            "Shared by dialogue, memory, and narration.",
          ],
          [
            "character_slots",
            "Character request slots",
            "Leave room for maintenance requests.",
          ],
          [
            "word_limit",
            "Words per message part",
            "Long speech is split mechanically.",
          ],
          [
            "max_parts",
            "Maximum parts per utterance",
            "Bounds the delivery queue.",
          ],
        ].map(([key, label, hint]) => (
          <Field label={label} hint={hint} key={key}>
            <input
              type="number"
              step={
                key.includes("cooldown") || key === "global_gap" ? "0.5" : "1"
              }
              value={form[key]}
              onChange={(e) => set(key, Number(e.target.value))}
            />
          </Field>
        ))}
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={form.auto_resume}
          onChange={(e) => set("auto_resume", e.target.checked)}
        />
        Automatically resume running worlds after a backend restart
      </label>
      <p className="quiet">
        By default, a backend restart restores worlds paused. Closing the
        browser or navigating away never pauses a running session.
      </p>
    </>
  );
}
