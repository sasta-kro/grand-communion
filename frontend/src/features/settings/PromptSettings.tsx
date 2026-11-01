import { Field } from "../../components/ui";
import type { SettingsSectionProps } from "./types";
export function PromptSettings({ form, set }: SettingsSectionProps) {
  return (
    <>
      <h2>Editable instructions</h2>
      <Field label="Global speech rules">
        <textarea
          className="prompt-editor"
          rows={5}
          value={form.speech_rules || ""}
          onChange={(e) => set("speech_rules", e.target.value)}
        />
      </Field>
      <p>
        Applies to every character on its next generation, across all providers
        and worlds, including loaded saves. This controls spoken text, not JSON
        syntax, private memories, or narrator reports. Scene overrides cannot
        replace these rules.
      </p>
      <p>
        Character instructions can use {"{name}"} and {"{word_limit}"}. Memory
        instructions can use {"{target_words}"}. Public dialogue is always
        treated as data.
      </p>
      {[
        ["character_prompt", "Character behavior"],
        ["memory_prompt", "First-person memory compaction"],
        ["narrator_prompt", "Narrator style and notable moments"],
      ].map(([key, label]) => (
        <Field key={key} label={label}>
          <textarea
            className="prompt-editor"
            rows={10}
            value={form[key]}
            onChange={(e) => set(key, e.target.value)}
          />
        </Field>
      ))}
    </>
  );
}
