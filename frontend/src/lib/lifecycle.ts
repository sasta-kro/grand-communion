import { tr } from "../i18n";

export function forkWarningText(warning: string): string {
  return tr(
    warning === "earlier_save"
      ? "lifecycle.forkWarning.earlier_save"
      : "lifecycle.forkWarning.opening_setup",
  );
}
