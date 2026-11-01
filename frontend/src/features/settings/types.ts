import type { Data, BootstrapData } from "../../lib/types";
export interface SettingsSectionProps {
  boot: BootstrapData;
  form: Data;
  set: (key: string, value: unknown) => void;
}
