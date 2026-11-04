import { tr, type MessageKey } from "../i18n";
import type { RequestRecord } from "./types";

const statusKeys: Record<string, MessageKey> = {
  queued: "request.queued",
  requesting: "request.requesting",
  reasoning: "request.reasoning",
  speaking: "request.speaking",
  backoff: "request.backoff",
  completed: "request.completed",
  no_response: "request.noResponse",
  cancelled: "request.cancelled",
  interrupted: "request.interrupted",
  error: "request.error",
  paused: "request.paused",
  running: "request.running",
  configured: "request.configured",
  needs_key: "request.needsKey",
  idle: "request.idle",
  cooldown: "request.cooldown",
  delivery: "request.delivery",
};
export function requestStatusLabel(status: string): string {
  return statusKeys[status]
    ? tr(statusKeys[status])
    : status.replaceAll("_", " ");
}
export function requestKindLabel(kind: string): string {
  const key = (
    {
      character: "request.kind.character",
      memory: "request.kind.memory",
      narrator: "request.kind.narrator",
    } as Record<string, MessageKey>
  )[kind];
  return key ? tr(key) : kind;
}
export function requestStatusDescription(record: RequestRecord): string {
  if (record.status === "no_response") return tr("help.status.noResponse");
  if (record.status === "interrupted") return tr("help.status.interrupted");
  const reasons: Record<string, MessageKey> = {
    session_paused: "request.cancelReason.sessionPaused",
    session_archived: "request.cancelReason.sessionArchived",
    session_deleted: "request.cancelReason.sessionDeleted",
    server_shutdown: "request.cancelReason.serverShutdown",
    settings_changed: "request.cancelReason.settingsChanged",
    cast_changed: "request.cancelReason.castChanged",
    session_changed: "request.cancelReason.sessionChanged",
    task_cancelled: "request.cancelReason.taskCancelled",
  };
  const key = reasons[record.metrics.cancel_reason];
  return tr(key || "request.cancelReason.notRecorded");
}

export function reasoningEffortLabel(value?: string): string {
  const keys: Record<string, MessageKey> = {
    auto: "providers.effort.auto",
    low: "providers.effort.low",
    high: "providers.effort.high",
    max: "providers.effort.max",
  };
  return value && keys[value]
    ? tr(keys[value])
    : value || tr("providers.defaultEffort");
}
export function logLevelLabel(value: string): string {
  const keys: Record<string, MessageKey> = {
    DEBUG: "logs.level.debug",
    INFO: "logs.level.info",
    WARNING: "logs.level.warning",
    ERROR: "request.error",
  };
  return keys[value] ? tr(keys[value]) : value;
}
