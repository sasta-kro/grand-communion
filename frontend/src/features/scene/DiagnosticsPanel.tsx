import { Activity, X } from "lucide-react";
import { HelpLabel } from "../../components/HelpLabel";
import { Sparkline } from "../../components/Sparkline";
import { Badge, Button, Field } from "../../components/ui";
import { tr, type MessageKey } from "../../i18n";
import { fmt, seconds, stamp } from "../../lib/format";
import {
  logLevelLabel,
  reasoningEffortLabel,
  requestKindLabel,
  requestStatusDescription,
  requestStatusLabel,
} from "../../lib/requestStatus";
import { Data } from "../../lib/types";
import { SceneModel } from "./useSceneController";

export function DiagnosticsPanel({ model }: { model: SceneModel }) {
  const {
    scene,
    requests,
    logs,
    diagnostics,
    setDiagnostics,
    tab,
    setTab,
    reqId,
    setReqId,
    detail,
    detailError,
    detailLoading,
    retryDetail,
    level,
    setLevel,
    charFilter,
    setCharFilter,
    charName,
    active,
    complete,
    failures,
    latency,
  } = model;

  const tabKeys: Record<string, MessageKey> = {
    Status: "diagnostics.tab.status",
    Requests: "diagnostics.tab.requests",
    Reasoning: "diagnostics.tab.reasoning",
    Logs: "diagnostics.tab.logs",
  };
  const filteredLogs = logs.filter(
    (log) =>
      (!level || log.level === level) &&
      (!charFilter || log.character_id === charFilter),
  );
  return (
    <>
      {diagnostics && (
        <aside className="diagnostics">
          <div className="row between">
            <h3>
              <Activity size={16} />
              {tr("diagnostics.diagnostics")}
            </h3>
            <button
              className="icon"
              aria-label={tr("diagnostics.closeDiagnostics")}
              onClick={() => setDiagnostics(false)}
            >
              <X size={17} />
            </button>
          </div>
          <div className="tabs">
            {["Status", "Requests", "Reasoning", "Logs"].map((t) => (
              <button
                className={tab === t ? "selected" : ""}
                onClick={() => setTab(t)}
                key={t}
              >
                {tr(tabKeys[t])}
              </button>
            ))}
          </div>
          <div className="diagnostic-body">
            {tab === "Status" ? (
              <>
                <div className="stats">
                  <div>
                    <strong>{active.length}</strong>
                    <span>
                      <HelpLabel label={tr("diagnostics.inFlight")} />
                    </span>
                  </div>
                  <div>
                    <strong>
                      {complete.length
                        ? seconds(latency)
                        : tr("diagnostics.noTiming")}
                    </strong>
                    <span>
                      <HelpLabel label={tr("diagnostics.meanLatency")} />
                    </span>
                  </div>
                  <div>
                    <strong>{failures.length}</strong>
                    <span>
                      <HelpLabel label={tr("diagnostics.recentErrors")} />
                    </span>
                  </div>
                </div>
                <h4>
                  <HelpLabel label={tr("diagnostics.requestLatency")} />
                </h4>
                <Sparkline
                  values={complete
                    .slice(0, 40)
                    .reverse()
                    .map((r) => r.metrics.duration_ms)}
                />
                <p className="quiet tiny">
                  {tr("diagnostics.mostRecentCompletedRequestsSamples", {
                    length: complete.length,
                  })}
                </p>
                <h4>
                  <HelpLabel label={tr("diagnostics.requestOutcomes")} />
                </h4>
                <div className="outcome-chart">
                  {requests
                    .slice(0, 45)
                    .reverse()
                    .map((r) => (
                      <span
                        key={r.id}
                        className={
                          r.status === "error"
                            ? "failed"
                            : ["cancelled", "interrupted"].includes(r.status)
                              ? "cancelled"
                              : r.metrics.attempt > 1
                                ? "retried"
                                : "healthy"
                        }
                        title={`${requestStatusLabel(r.status)} · ${r.metrics.failure_kind || tr("diagnostics.noFailure")}`}
                      />
                    ))}
                </div>
                <p className="quiet tiny">
                  {tr("diagnostics.timeoutsThrottledRetried", {
                    length: requests.filter(
                      (r) => r.metrics.failure_kind === "timeout",
                    ).length,
                    length2: requests.filter(
                      (r) => r.metrics.http_status === 429,
                    ).length,
                    length3: requests.filter((r) => r.metrics.attempt > 1)
                      .length,
                  })}
                </p>
                <h4>
                  <HelpLabel label={tr("diagnostics.contextPressure")} />
                </h4>
                {scene.characters.map((c: Data) => {
                  const r = requests.find(
                    (r) => r.character_id === c.id && r.kind === "character",
                  );
                  const pct = r
                    ? Math.min(
                        100,
                        (r.metrics.estimated_input_tokens /
                          r.metrics.context_capacity) *
                          100,
                      )
                    : 0;
                  return (
                    <div className="context-meter" key={c.id}>
                      <div className="row between">
                        <strong>{c.name}</strong>
                        <span>{pct.toFixed(1)}%</span>
                      </div>
                      <div className="track">
                        <i style={{ width: `${Math.max(0.4, pct)}%` }} />
                      </div>
                      <small>
                        {r
                          ? tr("diagnostics.tokensEstimated", {
                              count: fmt(r.metrics.estimated_input_tokens),
                              count2: fmt(r.metrics.context_capacity),
                            })
                          : tr("diagnostics.noRequestYet")}
                      </small>
                    </div>
                  );
                })}
                <div className="info-box">
                  {tr(
                    "diagnostics.compactionAtContextFiguresAreEstimatesActualProvider",
                    { Math: Math.round(scene.settings.compact_ratio * 100) },
                  )}
                </div>
              </>
            ) : tab === "Logs" ? (
              <>
                <div className="filter-row">
                  <Field label={tr("diagnostics.logLevel")}>
                    <select
                      aria-label={tr("diagnostics.logLevel")}
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                    >
                      <option value="">{tr("diagnostics.allLevels")}</option>
                      {["DEBUG", "INFO", "WARNING", "ERROR"].map((l) => (
                        <option key={l} value={l}>
                          {logLevelLabel(l)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={tr("diagnostics.logCharacter")}>
                    <select
                      aria-label={tr("diagnostics.logCharacter")}
                      value={charFilter}
                      onChange={(e) => setCharFilter(e.target.value)}
                    >
                      <option value="">
                        {tr("diagnostics.allCharacters")}
                      </option>
                      {scene.characters.map((c: Data) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {filteredLogs.map((l) => (
                  <div className="log" key={l.id}>
                    <span className={"severity " + l.level}>
                      {logLevelLabel(l.level)}
                    </span>
                    <time>{stamp(l.at)}</time>
                    <p>{l.message}</p>
                    {l.character_id && (
                      <small>{charName(l.character_id)}</small>
                    )}
                  </div>
                ))}
                {!filteredLogs.length && (
                  <div className="empty-inline">
                    <p>
                      {logs.length
                        ? tr("diagnostics.noLogEntriesMatchTheseFilters")
                        : tr("diagnostics.noLogEntriesYetEventsAppearWhenThe")}
                    </p>
                    {logs.length > 0 && (
                      <Button
                        onClick={() => {
                          setLevel("");
                          setCharFilter("");
                        }}
                      >
                        {tr("diagnostics.clearFilters")}
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {!requests.length && (
                  <div className="empty-inline">
                    <p>
                      {tr(
                        "diagnostics.noRequestsYetResumeTheSessionToGenerate",
                      )}
                    </p>
                  </div>
                )}
                <div className="request-list">
                  {requests.map((r) => (
                    <button
                      className={`request-row ${reqId === r.id ? "chosen" : ""}`}
                      key={r.id}
                      onClick={() => setReqId(r.id)}
                    >
                      <span>
                        <strong>{charName(r.character_id)}</strong>
                        <small>
                          {requestKindLabel(r.kind)} · {stamp(r.created)}
                        </small>
                      </span>
                      <span>
                        <Badge value={r.status} />
                        <small>{seconds(r.metrics.duration_ms)}</small>
                      </span>
                    </button>
                  ))}
                </div>
                {detail ? (
                  <div className="request-detail">
                    <h4>
                      {charName(detail.character_id)} ·{" "}
                      {requestKindLabel(detail.kind)}
                    </h4>
                    {["cancelled", "interrupted", "no_response"].includes(
                      detail.status,
                    ) && (
                      <p className="info-box" role="status">
                        {requestStatusDescription(detail)}
                      </p>
                    )}
                    <dl>
                      <dt>
                        <HelpLabel
                          label={tr("diagnostics.writingCorrections")}
                        />
                      </dt>
                      <dd>
                        {detail.metrics.policy_retries ??
                          tr("common.notRecorded")}
                      </dd>
                      <dt>
                        <HelpLabel label={tr("diagnostics.status")} />
                      </dt>
                      <dd>
                        <Badge value={detail.status} />
                      </dd>
                      <dt>
                        <HelpLabel label={tr("diagnostics.model")} />
                      </dt>
                      <dd>{detail.metrics.model}</dd>
                      <dt>
                        <HelpLabel
                          label={tr("diagnostics.observationCutoff")}
                        />
                      </dt>
                      <dd>#{detail.cutoff}</dd>
                      <dt>
                        <HelpLabel label={tr("providers.reasoningEffort")} />
                      </dt>
                      <dd>
                        {reasoningEffortLabel(detail.metrics.reasoning_effort)}
                      </dd>
                      <dt>
                        <HelpLabel label={tr("diagnostics.queueDelay")} />
                      </dt>
                      <dd>{seconds(detail.metrics.queue_ms)}</dd>
                      <dt>
                        <HelpLabel label={tr("diagnostics.firstToken")} />
                      </dt>
                      <dd>{seconds(detail.metrics.first_token_ms)}</dd>
                      <dt>
                        <HelpLabel label={tr("diagnostics.reasoningPhase")} />
                      </dt>
                      <dd>{seconds(detail.metrics.reasoning_ms)}</dd>
                      <dt>
                        <HelpLabel label={tr("diagnostics.totalDuration")} />
                      </dt>
                      <dd>{seconds(detail.metrics.duration_ms)}</dd>
                      <dt>
                        <HelpLabel label={tr("diagnostics.httpStatus")} />
                      </dt>
                      <dd>
                        {detail.metrics.http_status ?? tr("common.notRecorded")}
                      </dd>
                      {detail.metrics.failure_kind && (
                        <>
                          <dt>
                            <HelpLabel label={tr("diagnostics.lastFailure")} />
                          </dt>
                          <dd>{detail.metrics.failure_kind}</dd>
                        </>
                      )}
                      {detail.metrics.elapsed_ms != null && (
                        <>
                          <dt>
                            <HelpLabel
                              label={tr("diagnostics.cancellationTime")}
                            />
                          </dt>
                          <dd>{seconds(detail.metrics.elapsed_ms)}</dd>
                        </>
                      )}
                      <dt>
                        <HelpLabel label={tr("diagnostics.tokenUsage")} />
                      </dt>
                      <dd>
                        {fmt(detail.metrics.usage?.input_tokens)} /{" "}
                        {fmt(detail.metrics.usage?.output_tokens)}
                      </dd>
                      <dt>
                        <HelpLabel label={tr("diagnostics.finishReason")} />
                      </dt>
                      <dd>
                        {detail.metrics.finish_reason ||
                          (["cancelled", "interrupted", "error"].includes(
                            detail.status,
                          )
                            ? tr("common.notRecorded")
                            : tr("diagnostics.pending"))}
                      </dd>
                      <dt>
                        <HelpLabel label={tr("diagnostics.attempt")} />
                      </dt>
                      <dd>{detail.metrics.attempt || 1}</dd>
                    </dl>
                    {detail.error && (
                      <p className="error-text">{detail.error}</p>
                    )}
                    <h4>
                      <HelpLabel label={tr("diagnostics.providerReasoning")} />
                    </h4>
                    {detail.metrics.reasoning_truncated && (
                      <p className="quiet tiny">
                        {tr(
                          "diagnostics.capturedReasoningReachedItsStorageLimit",
                        )}
                      </p>
                    )}
                    <pre className="reasoning">
                      {detail.reasoning ||
                        (detail.status === "cancelled"
                          ? tr("diagnostics.noReasoningBeforeCancellation")
                          : !scene.settings.capture_reasoning
                            ? tr(
                                "diagnostics.reasoningCaptureIsOffEnableItInSettings",
                              )
                            : tr(
                                "diagnostics.noReasoningTextWasExposedForThisRequest",
                              ))}
                    </pre>
                  </div>
                ) : detailError ? (
                  <div className="info-box" role="alert">
                    <p>{tr("diagnostics.couldNotLoadRequestDetails")}</p>
                    <p>{detailError}</p>
                    <Button onClick={retryDetail}>{tr("common.retry")}</Button>
                  </div>
                ) : detailLoading ? (
                  <p role="status">{tr("diagnostics.loadingRequestDetails")}</p>
                ) : requests.length > 0 ? (
                  <p className="quiet">
                    {tr("diagnostics.selectARequestToInspectItsTimingUsage")}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
