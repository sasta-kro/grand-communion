import { Checkbox, Field } from "../../components/ui";
import { tr } from "../../i18n";
import type { SettingsSectionProps } from "./types";
export function RuntimeSettings({ form, set }: SettingsSectionProps) {
  return (
    <>
      <h2>{tr("settings.runtime.timingAndConcurrency")}</h2>
      <p>{tr("settings.runtime.eachCooldownSendsTheCurrentBoardTailAnd")}</p>
      <div className="form-grid">
        {[
          [
            "cooldown",
            tr("settings.defaultCharacterCooldown"),
            tr("settings.runtime.secondsAfterACompletedRequest"),
          ],
          [
            "global_gap",
            tr("settings.globalDeliveryGap"),
            tr("settings.runtime.minimumSecondsBetweenDeliveredSpeechParts"),
          ],
          [
            "max_concurrency",
            tr("settings.runtime.totalRequestConcurrency"),
            tr("settings.runtime.sharedByDialogueMemoryAndNarration"),
          ],
          [
            "character_slots",
            tr("settings.runtime.characterRequestSlots"),
            tr("settings.runtime.leaveRoomForMaintenanceRequests"),
          ],
          [
            "word_limit",
            tr("settings.wordsPerPart"),
            tr("settings.runtime.longSpeechIsSplitMechanically"),
          ],
          [
            "max_parts",
            tr("settings.maximumSpeechParts"),
            tr("settings.runtime.boundsTheDeliveryQueue"),
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
      <Checkbox
        checked={form.auto_resume}
        onChange={(e) => set("auto_resume", e.target.checked)}
        label={tr(
          "settings.runtime.automaticallyResumeRunningWorldsAfterABackendRestart",
        )}
      />
      <p className="quiet">
        {tr("settings.runtime.byDefaultABackendRestartRestoresWorldsPaused")}
      </p>
    </>
  );
}
