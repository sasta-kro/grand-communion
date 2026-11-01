# Interface text, languages, and contextual help

Communion keeps application text separate from character prompts and world content. English is the only installed interface language. The language control in **Settings > Interface** lists registered languages and explains when no alternative is installed. The choice is stored per browser.

## Resource files

- `frontend/src/i18n/en.json` contains interface labels, instructions, notifications, status names, and help descriptions.
- `frontend/src/i18n/help-topics.json` connects stable label-message IDs to help-message IDs.
- `frontend/src/i18n/index.ts` registers languages, configures i18next, and exposes the typed `tr()` function.
- `frontend/src/i18n/help.ts` resolves contextual help using the current translated labels.

Keys are stable identifiers, such as `settings.globalDeliveryGap` and `help.globalGap`. Change a message's wording by editing its value rather than renaming its key. Keys contain dots but the resources use a flat JSON object, with i18next's key separator disabled.

Write complete messages with named interpolations. For example, `Replying to {{name}} · #{{id}}` can be reordered by a translator. Do not concatenate English sentence fragments around variables. Pass numeric `count` values when using i18next plural variants such as `_one` and `_other`.

Route names, status codes, protocol identifiers, and API field names remain stable even when their displayed labels are translated. Number and date formatting uses the interface locale. Diagnostic log bodies, provider output, and backend error details remain the original data rather than being machine-translated.

## Add another language

1. Copy `en.json` to a language file such as `fr.json` and translate its values. Preserve message keys, interpolation names, and any literal technical identifiers.
2. Import that JSON resource in `i18n/index.ts`, using the same JSON import syntax as English.
3. Add an entry to `interfaceLanguages` with its language code, native name, formatting locale, and message object. The selector then enables the new option.
4. Check translated layouts, long labels, plural forms, keyboard navigation, and right-to-left layout where applicable. Document language and direction update with the selection, but each added language still needs layout review.
5. Run `npm --prefix frontend test` and the production build. English supplies fallback values for missing keys. The tests exercise interpolation, plurals, fallback, translated help binding, and resource references.

Adding an interface language does not translate scenario names or descriptions, ambient identities, character names, model prompts, dialogue, memories, or narrator reports. Those belong to the world or model configuration.

## Contextual help

Hover a technical label or focus its question-mark control to show an explanation. Click or tap the question mark to keep it open. Escape dismisses help first; a second Escape can close the surrounding dialog. The bubble stays inside the viewport and outside scroll-container clipping. Inside a dialog it remains in the dialog's accessible content.

Shared `Field` and `Checkbox` components keep the actual input label separate from the help control. Help controls do not change field values. `HelpLabel` can also annotate diagnostic terms. For an ordinary label, add a message-ID binding in `help-topics.json`. For formatted or context-dependent labels, pass an explicit translated `help` value.

Help descriptions should explain the unit, scope, effect, important interactions, and any special value such as zero. A global delivery gap, for example, limits public delivery within a session; it does not control model-request frequency.

The frontend resource test rejects new literal JSX text and static label attributes. Keep new visible text in the resource file. Dynamic world data and raw diagnostics are intentionally not resources.
