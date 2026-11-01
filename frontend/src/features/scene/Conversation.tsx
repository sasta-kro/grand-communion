import { ChevronDown, Compass, Search } from "lucide-react";
import { api } from "../../lib/api";
import { Composer } from "./Composer";
import { Message } from "./Message";
import { SceneModel } from "./useSceneController";

export function Conversation({ model }: { model: SceneModel }) {
  const {
    id,
    fail,
    notify,
    scene,
    setScene,
    newCount,
    setNewCount,
    search,
    setSearch,
    scroll,
    pinned,
    pendingFocus,
    manualScrollUntil,
    filtered,
    virtualizer,
  } = model;

  return (
    <>
      <section className="conversation">
        <div className="transcript-toolbar">
          <span>PUBLIC CONVERSATION</span>
          {scene.messages.length >= 200 && (
            <button
              className="text-button quiet"
              onClick={async () => {
                try {
                  const first = scene.messages[0].id;
                  const rows = await api(
                    `/sessions/${id}/messages?before=${first - 1}&limit=200`,
                  );
                  pinned.current = false;
                  pendingFocus.current = first;
                  setScene({
                    ...scene,
                    messages: [...rows, ...scene.messages],
                  });
                  if (!rows.length) notify("Beginning of conversation reached");
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Earlier messages
            </button>
          )}
          <label>
            <Search size={14} />
            <input
              aria-label="Search loaded messages"
              placeholder="Find in conversation"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div
          className="transcript"
          ref={scroll}
          tabIndex={0}
          aria-label="Conversation transcript"
          onWheel={() => {
            manualScrollUntil.current = Date.now() + 1500;
          }}
          onTouchMove={() => {
            manualScrollUntil.current = Date.now() + 1500;
          }}
          onPointerDown={() => {
            manualScrollUntil.current = Date.now() + 1500;
          }}
          onKeyDown={() => {
            manualScrollUntil.current = Date.now() + 1500;
          }}
          onScroll={() => {
            if (scroll.current && Date.now() < manualScrollUntil.current) {
              pinned.current =
                scroll.current.scrollHeight -
                  scroll.current.scrollTop -
                  scroll.current.clientHeight <
                100;
              if (pinned.current) setNewCount(0);
            }
          }}
        >
          {!filtered.length && (
            <div className="empty-scene">
              <Compass size={38} />
              <h2>{search ? "No matching messages" : "No messages yet"}</h2>
              <p>
                {search
                  ? "Try another name or phrase."
                  : "Resume the session to let the characters speak, or add a voice of your own."}
              </p>
            </div>
          )}
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((v) => {
              const m = filtered[v.index];
              return (
                <div
                  key={v.key}
                  data-index={v.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${v.start}px)`,
                  }}
                >
                  <Message model={model} m={m} />
                </div>
              );
            })}
          </div>
        </div>
        {newCount > 0 && (
          <button
            className="jump"
            onClick={() => {
              pinned.current = true;
              setNewCount(0);
              virtualizer.scrollToIndex(filtered.length - 1, {
                align: "end",
              });
            }}
          >
            {newCount} new messages
            <ChevronDown size={14} />
          </button>
        )}
        <Composer model={model} />{" "}
      </section>
    </>
  );
}
