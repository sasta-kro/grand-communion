import bindings from "./help-topics.json" with { type: "json" };
import { i18n, tr, type MessageKey } from "./index.ts";

let language = "";
let translatedHelp = new Map<string, string>();
/** Bind help to translated labels using stable resource keys, not English text. */
export function helpForLabel(label: string): string | undefined {
  if (language !== i18n.language) {
    language = i18n.language;
    translatedHelp = new Map(
      Object.entries(bindings).map(([labelKey, helpKey]) => [
        tr(labelKey as MessageKey),
        tr(helpKey as MessageKey),
      ]),
    );
  }
  return translatedHelp.get(label);
}
