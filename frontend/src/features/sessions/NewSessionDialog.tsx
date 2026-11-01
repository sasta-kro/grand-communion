import { ArrowUpRight } from "lucide-react";
import { Button, Field, Modal } from "../../components/ui";
import { api } from "../../lib/api";
import { go } from "../../lib/navigation";
import { Data, PageProps } from "../../lib/types";

export function NewSessionDialog({
  boot,
  scenario,
  setScenario,
  name,
  setName,
  busy,
  run,
  refresh,
  onClose,
}: PageProps & {
  scenario: string;
  setScenario: (id: string) => void;
  name: string;
  setName: (name: string) => void;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Start a new world"
      subtitle="A new conversation with its own history and memories."
      onClose={() => onClose()}
    >
      <Field label="Scenario">
        <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
          {boot.scenarios.map((s: Data) => (
            <option value={s.id} key={s.id}>
              {s.name} · {s.cast.length} characters
            </option>
          ))}
        </select>
      </Field>
      <Field label="Session name" hint="Leave blank to use the scenario name.">
        <input
          placeholder="An evening at the gathering"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <div className="info-box">
        The session opens paused. You choose when its characters begin.
      </div>
      <div className="actions">
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button
          primary
          disabled={busy || !scenario}
          onClick={() =>
            run(async () => {
              const s = await api("/sessions", "POST", {
                scenario_id: scenario,
                name,
              });
              onClose();
              setName("");
              localStorage.setItem("communion:lastSession", s.id);
              await refresh();
              go("/scene/" + s.id);
            })
          }
        >
          Create session
          <ArrowUpRight size={16} />
        </Button>
      </div>
    </Modal>
  );
}
