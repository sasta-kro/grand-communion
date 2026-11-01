import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json" with { type: "json" };

export const interfaceLanguages = [
  { code: "en", name: "English", locale: "en-GB", messages: en },
];
export const i18n = createInstance();
const saved =
  typeof localStorage === "undefined"
    ? "en"
    : localStorage.getItem("communion:uiLanguage");
void i18n
  .use(initReactI18next)
  .init({
    resources: Object.fromEntries(
      interfaceLanguages.map((language) => [
        language.code,
        { translation: language.messages },
      ]),
    ),
    lng: interfaceLanguages.some((language) => language.code === saved)
      ? saved!
      : "en",
    fallbackLng: "en",
    keySeparator: false,
    interpolation: { escapeValue: false },
    initAsync: false,
  })
  .then(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = i18n.resolvedLanguage || "en";
      document.documentElement.dir = i18n.dir();
    }
  });
export type MessageKey = keyof typeof en;
export function tr(key: MessageKey, values?: Record<string, unknown>): string {
  return String(i18n.t(key, values));
}
export async function changeInterfaceLanguage(code: string) {
  if (!interfaceLanguages.some((language) => language.code === code)) return;
  await i18n.changeLanguage(code);
  if (typeof localStorage !== "undefined")
    localStorage.setItem("communion:uiLanguage", code);
  if (typeof document !== "undefined") {
    document.documentElement.lang = code;
    document.documentElement.dir = i18n.dir(code);
  }
}
export function interfaceLocale(): string {
  return (
    interfaceLanguages.find(
      (language) => language.code === i18n.resolvedLanguage,
    )?.locale ||
    i18n.resolvedLanguage ||
    "en-GB"
  );
}
