import { X } from "lucide-react";
import { Icon } from "../../components/Icon";
import { Field } from "../../components/ui";
import { tr } from "../../i18n";
import { Data } from "../../lib/types";
import { SceneModel } from "./useSceneController";
import { ReplyPreview } from "./ReplyPreview";

export function Composer({ model }: { model: SceneModel }) {
  const {
    scene,
    text,
    setText,
    identity,
    setIdentity,
    custom,
    setCustom,
    target,
    setTarget,
    reply,
    setReply,
    sending,
    send,
    focus,
  } = model;

  return (
    <>
      <div className="composer">
        {reply && (
          <div className="replying">
            <ReplyPreview
              messageId={reply.id}
              source={reply}
              onOpen={() => focus(reply.id)}
            />
            <button
              className="icon"
              aria-label={tr("chat.cancelReply")}
              onClick={() => setReply(null)}
            >
              <X size={13} />
            </button>
          </div>
        )}
        <div className="composer-options">
          <Field label={tr("chat.speakAs")}>
            <select
              aria-label={tr("chat.participationIdentity")}
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
            >
              <optgroup label={tr("chat.ambientVoices")}>
                {scene.scenario.ambient_voices.map((v: string) => (
                  <option value={"ambient:" + v} key={v}>
                    {v}
                  </option>
                ))}
              </optgroup>
              <optgroup label={tr("characters.characters")}>
                {scene.characters.map((c: Data) => (
                  <option value={"character:" + c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
              <option value="custom">{tr("chat.anotherNamedVoice")}</option>
            </select>
          </Field>
          <Field label={tr("chat.address")}>
            <select
              aria-label={tr("chat.messageAddressee")}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="everyone">{tr("chat.everyone")}</option>
              {scene.characters.map((c: Data) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {identity === "custom" && (
          <input
            aria-label={tr("chat.customVoiceName")}
            placeholder={tr("chat.speakerName")}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        )}
        <div className="compose-input">
          <textarea
            aria-label={tr("chat.yourContribution")}
            placeholder={tr("chat.typeAMessage")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            className="send"
            aria-label={tr("chat.sendContribution")}
            disabled={sending || !text.trim()}
            onClick={send}
          >
            <Icon name="send" size={21} />
          </button>
        </div>
        <small>{tr("chat.onlyTheSelectedSpeakerIsShownToCharacters")}</small>
      </div>
    </>
  );
}
