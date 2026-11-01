import type { Virtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useState, type RefObject } from "react";
import type { BoardMessage } from "../../lib/types";

interface TranscriptPositionOptions {
  sceneReady: boolean;
  filtered: BoardMessage[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  scroll: RefObject<HTMLDivElement | null>;
  pinned: RefObject<boolean>;
  pendingFocus: RefObject<number | null>;
  search: string;
}

/** Position measured rows before showing the first frame. Never animate startup. */
export function useTranscriptPosition({
  sceneReady,
  filtered,
  virtualizer,
  scroll,
  pinned,
  pendingFocus,
  search,
}: TranscriptPositionOptions) {
  const [ready, setReady] = useState(false);
  const totalSize = virtualizer.getTotalSize();
  useLayoutEffect(() => {
    if (!sceneReady || !scroll.current) return;
    if (!filtered.length) {
      setReady(true);
      return;
    }
    if (pendingFocus.current !== null) {
      const index = filtered.findIndex(
        (message) => message.id === pendingFocus.current,
      );
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: "center", behavior: "auto" });
        pendingFocus.current = null;
        setReady(true);
      }
      return;
    }
    if (ready) {
      if (pinned.current)
        virtualizer.scrollToIndex(filtered.length - 1, {
          align: "end",
          behavior: "auto",
        });
      return;
    }
    let frame = 0;
    let previousHeight = -1;
    const place = () => {
      const element = scroll.current;
      if (!element) return;
      virtualizer.scrollToIndex(filtered.length - 1, {
        align: "end",
        behavior: "auto",
      });
      const lastRow = element.querySelector(
        `[data-index="${filtered.length - 1}"]`,
      );
      const atEnd =
        element.scrollHeight - element.scrollTop - element.clientHeight < 2;
      if (lastRow && atEnd && previousHeight === element.scrollHeight) {
        setReady(true);
        return;
      }
      previousHeight = element.scrollHeight;
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [
    sceneReady,
    filtered.length,
    filtered.at(-1)?.id,
    totalSize,
    search,
    ready,
  ]);
  return ready;
}
