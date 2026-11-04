import type { Virtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { BoardMessage } from "../../lib/types";
import { animateTranscriptEnd } from "../../lib/transcriptMotion";

interface TranscriptPositionOptions {
  sceneReady: boolean;
  filtered: BoardMessage[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  scroll: RefObject<HTMLDivElement | null>;
  pinned: RefObject<boolean>;
  pendingFocus: RefObject<number | null>;
  search: string;
  focusVersion: number;
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
  focusVersion,
}: TranscriptPositionOptions) {
  const [ready, setReady] = useState(false);
  const lastMessage = useRef<number | undefined>(undefined);
  const following = useRef(false);
  const animation = useRef<(() => void) | undefined>(undefined);
  const cancelFollow = useCallback(() => {
    animation.current?.();
    following.current = false;
  }, []);
  const followToEnd = useCallback(() => {
    cancelFollow();
    const element = scroll.current;
    if (!element) return;
    virtualizer.cancelScroll();
    following.current = true;
    animation.current = animateTranscriptEnd(
      element,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      () => {
        following.current = false;
      },
    );
  }, [cancelFollow, scroll, virtualizer]);
  useEffect(() => cancelFollow, [cancelFollow]);
  const totalSize = virtualizer.getTotalSize();
  useLayoutEffect(() => {
    if (!sceneReady || !scroll.current) return;
    const tail = filtered.at(-1)?.id;
    const appended =
      lastMessage.current !== undefined &&
      tail !== undefined &&
      tail > lastMessage.current;
    lastMessage.current = tail;
    if (!filtered.length) {
      setReady(true);
      return;
    }
    if (pendingFocus.current !== null) {
      cancelFollow();
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
      if (pinned.current && appended && !search) followToEnd();
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
    focusVersion,
  ]);
  return { transcriptReady: ready, following, cancelFollow, followToEnd };
}
