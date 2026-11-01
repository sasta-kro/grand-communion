import { Send, X } from "lucide-react";
import { Data } from "../../lib/types";
import { SceneModel } from "./useSceneController";

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
  } = model;

  return (
    <>
      {" "}
      <div className="composer">
        {reply && (
          <div className="replying">
            Replying to {reply.name} · #{reply.id}
            <button className="icon" onClick={() => setReply(null)}>
              <X size={13} />
            </button>
          </div>
        )}
        <div className="composer-options">
          <label>
            Speak as
            <select
              aria-label="Participation identity"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
            >
              <optgroup label="Ambient voices">
                {scene.scenario.ambient_voices.map((v: string) => (
                  <option value={"ambient:" + v} key={v}>
                    {v}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Characters">
                {scene.characters.map((c: Data) => (
                  <option value={"character:" + c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
              <option value="custom">Another named voice...</option>
            </select>
          </label>
          <label>
            Address
            <select
              aria-label="Message addressee"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="everyone">Everyone</option>
              {scene.characters.map((c: Data) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {identity === "custom" && (
          <input
            aria-label="Custom voice name"
            placeholder="Name of the voice"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        )}
        <div className="compose-input">
          <textarea
            aria-label="Your contribution"
            placeholder="A voice from within the world..."
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
            aria-label="Send contribution"
            disabled={sending || !text.trim()}
            onClick={send}
          >
            <Send size={18} />
          </button>
        </div>
        <small>
          Your external identity is never included in the characters' context.
        </small>
      </div>
    </>
  );
}
