import { Checkbox, Field } from "../../components/ui";
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
      <h3>{tr("settings.prompts.forbiddenPunctuation")}</h3>
      <p>{tr("settings.prompts.punctuationEnforcement")}</p>
      {(
        [
          ["em_dash", "settings.prompts.banEmDash"],
          ["semicolon", "settings.prompts.banSemicolon"],
          ["colon", "settings.prompts.banColon"],
        ] as const
      ).map(([value, key]) => (
        <Checkbox
          key={value}
          label={tr(key)}
          checked={(
            form.forbidden_punctuation || ["em_dash", "semicolon", "colon"]
          ).includes(value)}
          onChange={(event) => {
            const selected = form.forbidden_punctuation || [
              "em_dash",
              "semicolon",
              "colon",
            ];
            set(
              "forbidden_punctuation",
              event.target.checked
                ? [...selected, value]
                : selected.filter((item: string) => item !== value),
            );
          }}
        />
      ))}

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
