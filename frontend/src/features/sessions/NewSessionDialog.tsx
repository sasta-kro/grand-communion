import { ArrowUpRight } from "lucide-react";
import { Button, Field, Modal } from "../../components/ui";
import { tr } from "../../i18n";
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
      title={tr("sessions.newSession")}
      subtitle={tr("sessions.aNewConversationWithItsOwnHistoryAnd")}
      onClose={() => onClose()}
    >
      <Field label={tr("sessions.scenario")}>
        <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
          {boot.scenarios.map((s: Data) => (
            <option value={s.id} key={s.id}>
              {tr("sessions.characters", {
                name: s.name,
                length: s.cast.length,
              })}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={tr("sessions.sessionName")}
        hint={tr("sessions.leaveBlankToUseTheScenarioName")}
      >
        <input
          placeholder={tr("sessions.sessionName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <div className="info-box">
        {tr("sessions.theSessionOpensPausedYouChooseWhenIts")}
      </div>
      <div className="actions">
        <Button onClick={() => onClose()}>{tr("common.cancel")}</Button>
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
          {tr("sessions.createSession")}
          <ArrowUpRight size={16} />
        </Button>
      </div>
    </Modal>
  );
}
