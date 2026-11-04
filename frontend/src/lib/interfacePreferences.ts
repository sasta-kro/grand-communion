import { useSyncExternalStore } from "react";

const key = "communion:tooltipDelaySeconds";
const initial =
  typeof localStorage === "undefined" ? NaN : Number(localStorage.getItem(key));
let tooltipDelay = Number.isFinite(initial) && initial > 0 ? initial : 0.6;
const listeners = new Set<() => void>();
const pauseKey = "communion:pauseAutoFollow";
let pauseAutoFollow =
  typeof localStorage !== "undefined" &&
  localStorage.getItem(pauseKey) === "true";
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getTooltipDelay = () => tooltipDelay;
export function setTooltipDelay(seconds: number): boolean {
  if (!Number.isFinite(seconds) || seconds <= 0) return false;
  tooltipDelay = seconds;
  if (typeof localStorage !== "undefined")
    localStorage.setItem(key, String(seconds));
  listeners.forEach((listener) => listener());
  return true;
}
export function useTooltipDelay() {
  return useSyncExternalStore(subscribe, getTooltipDelay, () => 0.6);
}
export const getPauseAutoFollow = () => pauseAutoFollow;
export function setPauseAutoFollow(value: boolean) {
  pauseAutoFollow = value;
  if (typeof localStorage !== "undefined")
    localStorage.setItem(pauseKey, String(value));
  listeners.forEach((listener) => listener());
}
export function usePauseAutoFollow() {
  return useSyncExternalStore(subscribe, getPauseAutoFollow, () => false);
}
export function scheduleTooltip(show: () => void, seconds: number) {
  const timer = setTimeout(show, Math.min(seconds * 1000, 2_147_483_647));
  return () => clearTimeout(timer);
}
