import { useTranslation } from "react-i18next";
import { Field } from "../../components/ui";
import { changeInterfaceLanguage, interfaceLanguages, tr } from "../../i18n";

export function InterfaceSettings() {
  const { i18n } = useTranslation();
  return (
    <>
      <h2>{tr("settings.tab.interface")}</h2>
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
