import { Plug, Plus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { HelpLabel } from "../../components/HelpLabel";
import {
  Badge,
  Button,
  Checkbox,
  Field,
  Modal,
  PageHeading,
} from "../../components/ui";
import { tr, type MessageKey } from "../../i18n";
import { api } from "../../lib/api";
import { fmt } from "../../lib/format";
import { Data, PageProps } from "../../lib/types";

export function Providers({ boot, refresh, fail, notify }: PageProps) {
  const [edit, setEdit] = useState<Data | null>(null);
  const effortKeys: Record<string, MessageKey> = {
    auto: "providers.effort.auto",
    low: "providers.effort.low",
    high: "providers.effort.high",
    max: "providers.effort.max",
  };
  const field = (key: string, value: any) =>
    setEdit((e: Data | null) => ({ ...e, [key]: value }));
  return (
    <div className="page">
      <PageHeading
        eyebrow=""
        title={tr("navigation.providers")}
        description={tr(
          "providers.providerDetailsStaySeparateFromCharactersScenesAnd",
        )}
        action={
          <Button
            primary
            onClick={() =>
              setEdit({
                id: crypto.randomUUID(),
                name: "",
                protocol: "openai",
                base_url: "http://localhost:11434/v1",
                model: "",
                key_env: "",
                context_tokens: 32768,
                max_output: 4096,
                requires_key: false,
                reasoning_effort: "auto",
                supports_effort: false,
                timeout: 90,
                concurrency: 4,
              })
            }
          >
            <Plus size={17} />
            {tr("providers.addProvider")}
          </Button>
        }
      />
      <div className="entity-grid">
        {boot.providers.map((p: Data) => (
          <article className="entity-card" key={p.id}>
            <div className="row between">
              <Plug size={24} />
              <Badge value={p.configured ? "configured" : "needs_key"} />
            </div>
            <h2>{p.name}</h2>
            <p className="model-name">{p.model}</p>
            <dl>
              <dt>
                <HelpLabel label={tr("providers.protocol")} />
              </dt>
              <dd>
                {p.protocol === "openai"
                  ? tr("providers.openaiCompatible")
                  : p.protocol}
              </dd>
              <dt>
                <HelpLabel label={tr("providers.context")} />
              </dt>
              <dd>
                {tr("providers.tokens", { count: fmt(p.context_tokens) })}
              </dd>
              <dt>
                <HelpLabel
                  label={tr("providers.reasoningEffort")}
                  help={tr("help.reasoningEffort")}
                />
              </dt>
              <dd>
                {p.supports_effort
                  ? tr(effortKeys[p.reasoning_effort])
                  : tr("providers.providerDefault")}
              </dd>
              <dt>
                <HelpLabel label={tr("providers.concurrency")} />
              </dt>
              <dd>
                {tr("providers.requests", { concurrency: p.concurrency })}
              </dd>
            </dl>
            <Button onClick={() => setEdit({ ...p, api_key: "" })}>
              {tr("providers.configure")}
              <SlidersHorizontal size={15} />
            </Button>
          </article>
        ))}
      </div>
      {edit && (
        <Modal
          title={tr("providers.providerSettings")}
          subtitle={tr(
            "providers.credentialsRemainLocalAndNeverAppearInCharacter",
          )}
          wide
          onClose={() => setEdit(null)}
        >
          <div className="form-grid">
            <Field label={tr("providers.displayName")}>
              <input
                value={edit.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </Field>
            <Field label={tr("providers.protocol")}>
              <select
                value={edit.protocol}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    protocol: e.target.value,
                    ...(e.target.value === "ollama"
                      ? {
                          base_url: "http://localhost:11434",
                          requires_key: false,
                          supports_effort: false,
                        }
                      : {}),
                  })
                }
              >
                <option value="openai">
                  {tr("providers.openaiCompatible")}
                </option>
                <option value="ollama">{tr("providers.ollamaNative")}</option>
                <option value="mock">{tr("providers.mockLaboratory")}</option>
              </select>
            </Field>
            <Field label={tr("providers.baseUrl")}>
              <input
                value={edit.base_url}
                onChange={(e) => field("base_url", e.target.value)}
              />
            </Field>
            <Field label={tr("providers.modelId")}>
              <input
                value={edit.model}
                onChange={(e) => field("model", e.target.value)}
              />
            </Field>
            <Field
              label={tr("providers.apiKey")}
              hint={
                edit.configured
                  ? tr("providers.aCredentialIsAlreadyAvailableLeaveBlankTo")
                  : tr("providers.optionalForALocalServer")
              }
            >
              <input
                type="password"
                autoComplete="off"
                value={edit.api_key || ""}
                onChange={(e) => field("api_key", e.target.value)}
              />
            </Field>
            <Field
              label={tr("providers.credentialEnvironmentVariable")}
              hint={tr("providers.autoUsesTheExistingLocalKeyForThe")}
            >
              <input
                value={edit.key_env}
                onChange={(e) => field("key_env", e.target.value)}
              />
            </Field>
            {[
              ["context_tokens", tr("providers.contextCapacity")],
              ["max_output", tr("providers.outputAllowanceIncludingReasoning")],
              ["timeout", tr("providers.requestTimeoutInSeconds")],
              ["concurrency", tr("providers.providerConcurrency")],
            ].map(([key, label]) => (
              <Field label={label} key={key}>
                <input
                  type="number"
                  value={edit[key]}
                  onChange={(e) => field(key, Number(e.target.value))}
                />
              </Field>
            ))}
          </div>
          <Checkbox
            checked={edit.requires_key ?? true}
            onChange={(e) => field("requires_key", e.target.checked)}
            label={tr("providers.requireAnApiCredentialForThisEndpoint")}
          />
          <Checkbox
            checked={edit.supports_effort}
            onChange={(e) => field("supports_effort", e.target.checked)}
            label={tr("providers.sendASupportedReasoningEffortParameter")}
          />
          {edit.supports_effort && (
            <Field label={tr("providers.reasoningEffort")}>
              <select
                value={edit.reasoning_effort}
                onChange={(e) => field("reasoning_effort", e.target.value)}
              >
                {["auto", "low", "high", "max"].map((x) => (
                  <option key={x} value={x}>
                    {tr(effortKeys[x])}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="actions">
            <Button
              primary
              disabled={!edit.name || !edit.model}
              onClick={async () => {
                try {
                  await api("/providers/" + edit.id, "PUT", edit);
                  setEdit(null);
                  await refresh();
                  notify(tr("providers.providerSaved"));
                } catch (e) {
                  fail(e);
                }
              }}
            >
              {tr("providers.saveProvider")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
