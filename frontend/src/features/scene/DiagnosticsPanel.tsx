import { Activity, X } from "lucide-react";
import { Sparkline } from "../../components/Sparkline";
import { Badge } from "../../components/ui";
import { fmt, seconds, stamp } from "../../lib/format";
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

  return (
    <>
      {" "}
      {diagnostics && (
        <aside className="diagnostics">
          <div className="row between">
            <h3>
              <Activity size={16} />
              Diagnostics
            </h3>
            <button
              className="icon"
              aria-label="Close diagnostics"
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
                {t}
              </button>
            ))}
          </div>
          <div className="diagnostic-body">
            {tab === "Status" ? (
              <>
                <div className="stats">
                  <div>
                    <strong>{active.length}</strong>
                    <span>In flight</span>
                  </div>
                  <div>
                    <strong>{seconds(latency) || "0 s"}</strong>
                    <span>Mean latency</span>
                  </div>
                  <div>
                    <strong>{failures.length}</strong>
                    <span>Recent errors</span>
                  </div>
                </div>
                <h4>REQUEST LATENCY</h4>
                <Sparkline
                  values={complete
                    .slice(0, 40)
                    .reverse()
                    .map((r) => r.metrics.duration_ms)}
                />
                <p className="quiet tiny">
                  Most recent completed requests · {complete.length} samples
                </p>
                <h4>RECENT REQUEST OUTCOMES</h4>
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
                            : r.metrics.attempt > 1
                              ? "retried"
                              : "healthy"
                        }
                        title={`${r.status} · ${r.metrics.failure_kind || "no failure"}`}
                      />
                    ))}
                </div>
                <p className="quiet tiny">
                  {
                    requests.filter((r) => r.metrics.failure_kind === "timeout")
                      .length
                  }{" "}
                  timeouts ·{" "}
                  {requests.filter((r) => r.metrics.http_status === 429).length}{" "}
                  throttled ·{" "}
                  {requests.filter((r) => r.metrics.attempt > 1).length} retried
                </p>
                <h4>CONTEXT PRESSURE</h4>
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
                          ? `${fmt(r.metrics.estimated_input_tokens)} / ${fmt(r.metrics.context_capacity)} tokens estimated`
                          : "No request yet"}
                      </small>
                    </div>
                  );
                })}
                <div className="info-box">
                  Compaction at {Math.round(scene.settings.compact_ratio * 100)}
                  %. Context figures are estimates; actual provider usage
                  appears in each request.
                </div>
              </>
            ) : tab === "Logs" ? (
              <>
                <div className="filter-row">
                  <select
                    aria-label="Log level"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  >
                    <option value="">All levels</option>
                    {["DEBUG", "INFO", "WARNING", "ERROR"].map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Log character"
                    value={charFilter}
                    onChange={(e) => setCharFilter(e.target.value)}
                  >
                    <option value="">All characters</option>
                    {scene.characters.map((c: Data) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                {logs
                  .filter(
                    (l) =>
                      (!level || l.level === level) &&
                      (!charFilter || l.character_id === charFilter),
                  )
                  .map((l) => (
                    <div className="log" key={l.id}>
                      <span className={"severity " + l.level}>{l.level}</span>
                      <time>{stamp(l.at)}</time>
                      <p>{l.message}</p>
                      {l.character_id && (
                        <small>{charName(l.character_id)}</small>
                      )}
                    </div>
                  ))}
                {!logs.length && (
                  <p className="quiet">Engine events will appear here.</p>
                )}
              </>
            ) : (
              <>
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
                          {r.kind} · {stamp(r.created)}
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
                      {charName(detail.character_id)} · {detail.kind}
                    </h4>
                    <dl>
                      <dt>Status</dt>
                      <dd>{detail.status}</dd>
                      <dt>Model</dt>
                      <dd>{detail.metrics.model}</dd>
                      <dt>Observation cutoff</dt>
                      <dd>#{detail.cutoff}</dd>
                      <dt>Reasoning effort</dt>
                      <dd>
                        {detail.metrics.reasoning_effort || "Provider default"}
                      </dd>
                      <dt>Queue delay</dt>
                      <dd>{seconds(detail.metrics.queue_ms)}</dd>
                      <dt>First token</dt>
                      <dd>{seconds(detail.metrics.first_token_ms)}</dd>
                      <dt>Reasoning phase</dt>
                      <dd>{seconds(detail.metrics.reasoning_ms)}</dd>
                      <dt>Total duration</dt>
                      <dd>{seconds(detail.metrics.duration_ms)}</dd>
                      <dt>HTTP status / failure</dt>
                      <dd>
                        {detail.metrics.http_status || "OK"}{" "}
                        {detail.metrics.failure_kind || ""}
                      </dd>
                      <dt>Input / output tokens</dt>
                      <dd>
                        {fmt(detail.metrics.usage?.input_tokens)} /{" "}
                        {fmt(detail.metrics.usage?.output_tokens)}
                      </dd>
                      <dt>Finish reason</dt>
                      <dd>{detail.metrics.finish_reason || "Pending"}</dd>
                      <dt>Attempt</dt>
                      <dd>{detail.metrics.attempt || 1}</dd>
                    </dl>
                    {detail.error && (
                      <p className="error-text">{detail.error}</p>
                    )}
                    <h4>PROVIDER REASONING</h4>
                    {detail.metrics.reasoning_truncated && (
                      <p className="quiet tiny">
                        Captured reasoning reached its storage limit.
                      </p>
                    )}
                    <pre className="reasoning">
                      {detail.reasoning ||
                        (!scene.settings.capture_reasoning
                          ? "Reasoning capture is off. Enable it in Settings."
                          : "No reasoning text was exposed for this request.")}
                    </pre>
                  </div>
                ) : (
                  <p className="quiet">
                    Select a request to inspect its timing, usage, and
                    reasoning.
                  </p>
                )}
              </>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
