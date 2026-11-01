import { Plug, Plus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Field, Modal, PageHeading } from "../../components/ui";
import { api } from "../../lib/api";
import { fmt } from "../../lib/format";
import { Data, PageProps } from "../../lib/types";

export function Providers({ boot, refresh, fail, notify }: PageProps) {
  const [edit, setEdit] = useState<Data | null>(null);
  const field = (key: string, value: any) =>
    setEdit((e: Data | null) => ({ ...e, [key]: value }));
  return (
    <div className="page">
      <PageHeading
        eyebrow="MODEL CONNECTIONS"
        title="One world. Any capable model."
        description="Provider details stay separate from characters, scenes, and memory."
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
            Add provider
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
              <dt>Protocol</dt>
              <dd>
                {p.protocol === "openai" ? "OpenAI-compatible" : p.protocol}
              </dd>
              <dt>Context</dt>
              <dd>{fmt(p.context_tokens)} tokens</dd>
              <dt>Reasoning</dt>
              <dd>
                {p.supports_effort ? p.reasoning_effort : "Provider default"}
              </dd>
              <dt>Concurrency</dt>
              <dd>{p.concurrency} requests</dd>
            </dl>
            <Button onClick={() => setEdit({ ...p, api_key: "" })}>
              Configure
              <SlidersHorizontal size={15} />
            </Button>
          </article>
        ))}
      </div>
      {edit && (
        <Modal
          title="Provider settings"
          subtitle="Credentials remain local and never appear in character context or save files."
          wide
          onClose={() => setEdit(null)}
        >
          <div className="form-grid">
            <Field label="Display name">
              <input
                value={edit.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </Field>
            <Field label="Protocol">
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
                <option value="openai">OpenAI-compatible</option>
                <option value="ollama">Ollama native</option>
                <option value="mock">Mock laboratory</option>
              </select>
            </Field>
            <Field label="Base URL">
              <input
                value={edit.base_url}
                onChange={(e) => field("base_url", e.target.value)}
              />
            </Field>
            <Field label="Model ID">
              <input
                value={edit.model}
                onChange={(e) => field("model", e.target.value)}
              />
            </Field>
            <Field
              label="API key"
              hint={
                edit.configured
                  ? "A credential is already available. Leave blank to keep it."
                  : "Optional for a local server."
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
              label="Credential environment variable"
              hint="AUTO uses the existing local key for the default GLM profile."
            >
              <input
                value={edit.key_env}
                onChange={(e) => field("key_env", e.target.value)}
              />
            </Field>
            {[
              ["context_tokens", "Context capacity"],
              ["max_output", "Output allowance, including reasoning"],
              ["timeout", "Request timeout in seconds"],
              ["concurrency", "Provider concurrency"],
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
          <label className="check">
            <input
              type="checkbox"
              checked={edit.requires_key ?? true}
              onChange={(e) => field("requires_key", e.target.checked)}
            />
            Require an API credential for this endpoint
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={edit.supports_effort}
              onChange={(e) => field("supports_effort", e.target.checked)}
            />
            Send a supported reasoning effort parameter
          </label>
          {edit.supports_effort && (
            <Field label="Reasoning effort">
              <select
                value={edit.reasoning_effort}
                onChange={(e) => field("reasoning_effort", e.target.value)}
              >
                {["auto", "low", "high", "max"].map((x) => (
                  <option key={x} value={x}>
                    {x === "auto"
                      ? "Auto (provider default)"
                      : x[0].toUpperCase() + x.slice(1)}
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
                  notify("Provider saved");
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Save provider
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
