import { interfaceLocale, tr } from "../i18n";
export const stamp = (t: number) =>
  new Date(t * 1000).toLocaleTimeString(interfaceLocale(), { hour12: false });
export const date = (t: number) =>
  new Date(t * 1000).toLocaleString(interfaceLocale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export const fmt = (n: number | undefined) =>
  n == null
    ? tr("format.unknown")
    : new Intl.NumberFormat(interfaceLocale(), {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
export const seconds = (n: number) =>
  n == null
    ? tr("common.notRecorded")
    : n < 1000
      ? tr("format.milliseconds", { value: Math.round(n) })
      : tr("format.seconds", {
          value: new Intl.NumberFormat(interfaceLocale(), {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(n / 1000),
        });
export const initials = (name: string) =>
  name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
export const color = (name: string) =>
  ["sage", "ochre", "blue", "mauve"][
    [...name].reduce((a, b) => a + b.charCodeAt(0), 0) % 4
  ];
