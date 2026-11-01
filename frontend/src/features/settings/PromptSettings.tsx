import { Field } from "../../components/ui";
import { tr } from "../../i18n";
import type { SettingsSectionProps } from "./types";
export function PromptSettings({ form, set }: SettingsSectionProps) {
  return (
    <>
      <h2>{tr("settings.prompts.editableInstructions")}</h2>
      <Field label={tr("settings.prompts.globalSpeechRules")}>
        <textarea
          className="prompt-editor"
          rows={5}
          value={form.speech_rules || ""}
          onChange={(e) => set("speech_rules", e.target.value)}
        />
      </Field>
      <p>{tr("settings.prompts.appliesToEveryCharacterOnItsNextGeneration")}</p>
      <p>
        {tr("settings.prompts.characterInstructionsCanUseNameAndWordLimit")}
      </p>
      {[
        ["character_prompt", tr("settings.prompts.characterBehavior")],
        ["memory_prompt", tr("settings.prompts.firstPersonMemoryCompaction")],
        [
          "narrator_prompt",
          tr("settings.prompts.narratorStyleAndNotableMoments"),
        ],
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
