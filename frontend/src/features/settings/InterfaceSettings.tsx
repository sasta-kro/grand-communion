import { useState } from "react";
import {
  useTooltipDelay,
  setTooltipDelay,
  usePauseAutoFollow,
  setPauseAutoFollow,
} from "../../lib/interfacePreferences";
import { useTranslation } from "react-i18next";
import { Checkbox, Field } from "../../components/ui";
import { changeInterfaceLanguage, interfaceLanguages, tr } from "../../i18n";

export function InterfaceSettings() {
  const { i18n } = useTranslation();
  const delay = useTooltipDelay();
  const pauseAutoFollow = usePauseAutoFollow();
  const [draft, setDraft] = useState(String(delay));
  const [invalid, setInvalid] = useState(false);
  return (
    <>
      <h2>{tr("settings.tab.interface")}</h2>
      <Field
        label={tr("settings.interface.tooltipDelay")}
        hint={
          invalid
            ? tr("settings.interface.positiveDelay")
            : tr("settings.interface.tooltipDelayHint")
        }
      >
        <input
          type="number"
          min="0"
          step="any"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            const number = Number(event.target.value);
            if (number > 0 && Number.isFinite(number)) {
              setTooltipDelay(number);
              setInvalid(false);
            }
          }}
          onBlur={() => {
            if (!(Number(draft) > 0) || !Number.isFinite(Number(draft))) {
              setInvalid(true);
              setDraft(String(delay));
            }
          }}
        />
      </Field>
      <Checkbox
        checked={pauseAutoFollow}
        onChange={(event) => setPauseAutoFollow(event.target.checked)}
        label={tr("settings.interface.pauseAutoFollow")}
      />
      <p className="hint">{tr("settings.interface.pauseAutoFollowHint")}</p>
      <p>{tr("settings.interfaceDescription")}</p>
      <Field
        label={tr("settings.interfaceLanguage")}
        hint={
          interfaceLanguages.length === 1
            ? tr("settings.interfaceOnlyEnglish")
            : undefined
        }
      >
        <select
          disabled={interfaceLanguages.length < 2}
          value={i18n.resolvedLanguage || "en"}
          onChange={(event) => void changeInterfaceLanguage(event.target.value)}
        >
          {interfaceLanguages.map((language) => (
            <option key={language.code} value={language.code}>
              {language.name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
