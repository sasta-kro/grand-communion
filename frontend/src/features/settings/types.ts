import type { BootstrapData, Data } from "../../lib/types";
export interface SettingsSectionProps {
  boot: BootstrapData;
  form: Data;
  set: (key: string, value: unknown) => void;
}
