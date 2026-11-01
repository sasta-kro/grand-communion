import { color, initials, stamp } from "../../lib/format";
import { BoardMessage, Data } from "../../lib/types";
import { SceneModel } from "./useSceneController";

export function Message({ model, m }: { model: SceneModel; m: BoardMessage }) {
  const { scene, setDiagnostics, setTab, setReply, setEdit, setReqId, focus } =
    model;

  return (
    <>
      {" "}
      <article className="message" id={"message-" + m.id} key={m.id}>
        <button
          className={"avatar " + color(m.name)}
          onClick={() => {
            const c = scene.characters.find((c: Data) => c.id === m.author_id);
            if (c) setEdit({ ...c });
          }}
        >
          {initials(m.name)}
        </button>
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
              Reply
            </button>
          </div>
          {m.reply_to && (
            <button className="reply-ref" onClick={() => focus(m.reply_to!)}>
              Replying to #{m.reply_to}
            </button>
          )}
          {m.addressees?.[0] !== "everyone" && (
            <div className="address">
              To{" "}
              {m.addressees
                .map(
                  (a: string) =>
                    scene.characters.find((c: Data) => c.id === a)?.name || a,
                )
                .join(", ")}{" "}
              · audible to everyone
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
                Inspect provider reasoning
              </button>
            )}
        </div>
      </article>
    </>
  );
}
