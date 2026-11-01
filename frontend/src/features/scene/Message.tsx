import { Avatar } from "../../components/Avatar";
import { tr } from "../../i18n";
import { stamp } from "../../lib/format";
import { BoardMessage, Data } from "../../lib/types";
import { SceneModel } from "./useSceneController";

export function Message({ model, m }: { model: SceneModel; m: BoardMessage }) {
  const { scene, setDiagnostics, setTab, setReply, setEdit, setReqId, focus } =
    model;

  const character = scene.characters.find((c) => c.id === m.author_id);
  return (
    <>
      <article className="message" id={"message-" + m.id} key={m.id}>
        {character ? (
          <button
            className="avatar-button"
            aria-label={tr("common.viewCharacter", { name: m.name })}
            onClick={() => setEdit({ ...character })}
          >
            <Avatar name={m.name} />
          </button>
        ) : (
          <span
            className="avatar-static"
            title={tr("chat.thisSpeakerHasNoCharacterProfile")}
          >
            <Avatar name={m.name} />
          </span>
        )}
        <div className="message-content">
          <div className="message-header">
            <strong>{m.name}</strong>
            <time>{stamp(m.at)}</time>
            <span className="message-number">#{m.id}</span>
            {m.parts > 1 && (
              <small>
                {m.part + 1}/{m.parts}
              </small>
            )}
            <button className="reply-link" onClick={() => setReply(m)}>
              {tr("chat.reply")}
            </button>
          </div>
          {m.reply_to && (
            <button className="reply-ref" onClick={() => focus(m.reply_to!)}>
              {tr("chat.replyingTo2", { replyto: m.reply_to })}
            </button>
          )}
          {m.addressees?.[0] !== "everyone" && (
            <div className="address">
              {tr("chat.toAudibleToEveryone", {
                namea: m.addressees
                  .map(
                    (a: string) =>
                      scene.characters.find((c: Data) => c.id === a)?.name || a,
                  )
                  .join(", "),
              })}
            </div>
          )}
          <p>{m.text}</p>
          {scene.settings.show_reasoning_in_chat &&
            !m.request_id.startsWith("operator-") && (
              <button
                className="text-button quiet"
                onClick={() => {
                  setDiagnostics(true);
                  setTab("Reasoning");
                  setReqId(m.request_id);
                }}
              >
                {tr("chat.inspectProviderReasoning")}
              </button>
            )}
        </div>
      </article>
    </>
  );
}
