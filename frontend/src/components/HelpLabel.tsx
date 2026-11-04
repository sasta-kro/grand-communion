import { useTooltipDelay, scheduleTooltip } from "../lib/interfacePreferences";
import { CircleHelp } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { tr } from "../i18n";
import { helpForLabel } from "../i18n/help";

/** A portal keeps help visible outside scrolling panels and modal clipping. */
export function HelpLabel({
  label,
  help,
  icon = true,
  labelFor,
}: {
  label: string;
  help?: string;
  icon?: boolean;
  labelFor?: string;
}) {
  const content = help || helpForLabel(label);
  const hoverDelay = useTooltipDelay();
  const cancelHover = useRef<(() => void) | undefined>(undefined);
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const pinned = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const show = () => {
    cancelHover.current?.();
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hover = () => {
    clearTimeout(closeTimer.current);
    cancelHover.current?.();
    if (!open)
      cancelHover.current = scheduleTooltip(() => setOpen(true), hoverDelay);
  };
  const hide = () => {
    cancelHover.current?.();
    if (!pinned.current)
      closeTimer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(
    () => () => {
      clearTimeout(closeTimer.current);
      cancelHover.current?.();
    },
    [],
  );
  useLayoutEffect(() => {
    if (!open || !content) return;
    const place = () => {
      if (!anchor.current || !bubble.current) return;
      const rect = anchor.current.getBoundingClientRect();
      const size = bubble.current.getBoundingClientRect();
      const above = rect.top - size.height - 9;
      setPosition({
        left: Math.max(
          12,
          Math.min(rect.left, window.innerWidth - size.width - 12),
        ),
        top: Math.max(
          12,
          Math.min(
            above > 12 ? above : rect.bottom + 9,
            window.innerHeight - size.height - 12,
          ),
        ),
      });
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        pinned.current = false;
        setOpen(false);
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        !anchor.current?.contains(event.target as Node) &&
        !bubble.current?.contains(event.target as Node)
      ) {
        pinned.current = false;
        setOpen(false);
      }
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open, content]);
  if (!content)
    return labelFor ? <label htmlFor={labelFor}>{label}</label> : <>{label}</>;
  return (
    <span
      ref={anchor}
      className="help-label"
      onMouseEnter={hover}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={() => {
        pinned.current = false;
        hide();
      }}
      aria-describedby={open ? id : undefined}
    >
      {labelFor ? (
        <label htmlFor={labelFor}>{label}</label>
      ) : (
        <span>{label}</span>
      )}
      {icon && (
        <span
          className="help-trigger"
          role="button"
          tabIndex={0}
          aria-label={tr("common.helpFor", { label })}
          aria-expanded={open}
          aria-describedby={open ? id : undefined}
          onPointerDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            cancelHover.current?.();
            clearTimeout(closeTimer.current);
            pinned.current = !pinned.current;
            setOpen(pinned.current);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              cancelHover.current?.();
              clearTimeout(closeTimer.current);
              pinned.current = !pinned.current;
              setOpen(pinned.current);
            }
          }}
        >
          <CircleHelp size={13} aria-hidden="true" />
        </span>
      )}
      {open &&
        createPortal(
          <div
            ref={bubble}
            id={id}
            className="help-bubble"
            role="tooltip"
            style={position}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            {content}
          </div>,
          anchor.current?.closest('[role="dialog"]') || document.body,
        )}
    </span>
  );
}
