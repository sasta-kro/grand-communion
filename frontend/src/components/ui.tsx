import { LoaderCircle, X } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  MouseEvent,
  ReactElement,
  ReactNode,
} from "react";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { tr } from "../i18n";
import { requestStatusLabel } from "../lib/requestStatus";
import { HelpLabel } from "./HelpLabel";

export function Button({
  children,
  onClick,
  primary = false,
  disabled = false,
  className = "",
  title,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  primary?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <button
      {...props}
      type={props.type || "button"}
      title={title}
      aria-busy={pending || undefined}
      className={`button ${primary ? "primary" : ""} ${className}`}
      onClick={async (event) => {
        const result = onClick?.(event);
        if (!result || typeof result.then !== "function") return;
        setPending(true);
        try {
          await result;
        } finally {
          setPending(false);
        }
      }}
      disabled={disabled || pending}
    >
      {pending && (
        <LoaderCircle className="spin" size={14} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  const id = useId();
  const child = Children.only(children);
  const control = isValidElement(child)
    ? cloneElement(
        child as ReactElement<{ id?: string; "aria-describedby"?: string }>,
        { id, "aria-describedby": hint ? id + "-hint" : undefined },
      )
    : child;
  return (
    <div className="field">
      <HelpLabel label={label} labelFor={id} />
      {control}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ) || []),
      ].filter((node) => node.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      className="scrim"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
      >
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon"
            aria-label={tr("common.closeDialog")}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

export function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value}`}>
      <i />
      <HelpLabel label={requestStatusLabel(value)} icon={false} />
    </span>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action}
      </div>
    </>
  );
}

export function Checkbox({
  label,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  const id = useId();
  return (
    <div className="check">
      <input {...props} id={id} type="checkbox" />
      <HelpLabel label={label} labelFor={id} />
    </div>
  );
}
