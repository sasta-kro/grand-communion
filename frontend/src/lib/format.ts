export const stamp = (t: number) =>
  new Date(t * 1000).toLocaleTimeString("en-GB", { hour12: false });
export const date = (t: number) =>
  new Date(t * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export const fmt = (n: number | undefined) =>
  n == null
    ? "Unknown"
    : new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
export const seconds = (n: number) =>
  n == null
    ? ""
    : n < 1000
      ? `${Math.round(n)} ms`
      : `${(n / 1000).toFixed(1)} s`;
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
