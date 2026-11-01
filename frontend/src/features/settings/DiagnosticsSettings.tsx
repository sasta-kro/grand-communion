import { Checkbox, Field } from "../../components/ui";
import { tr } from "../../i18n";
import type { SettingsSectionProps } from "./types";
export function DiagnosticsSettings({ form, set }: SettingsSectionProps) {
  return (
    <>
      <h2>{tr("diagnostics.diagnostics")}</h2>
      <Checkbox
        checked={form.capture_reasoning}
        onChange={(e) => set("capture_reasoning", e.target.checked)}
        label={tr(
          "settings.diagnostics.captureProviderReturnedReasoningForThePrivateInspector",
        )}
      />
      <Checkbox
        checked={form.show_reasoning_in_chat}
        onChange={(e) => set("show_reasoning_in_chat", e.target.checked)}
        label={tr(
          "settings.diagnostics.showReasoningInspectorLinksAlongsideDialogue",
        )}
      />
      <Field
        label={tr(
          "settings.diagnostics.reasoningStorageLimitPerRequestInCharacters",
        )}
      >
        <input
          type="number"
          value={form.reasoning_limit}
          onChange={(e) => set("reasoning_limit", Number(e.target.value))}
        />
      </Field>
      <div className="info-box">
        {tr(
          "settings.diagnostics.reasoningEffortBelongsToEachProviderProfileHiding",
        )}
      </div>
    </>
  );
}
