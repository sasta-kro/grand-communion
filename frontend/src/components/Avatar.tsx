import { color, initials } from "../lib/format";
import { Icon } from "./Icon";

export function Avatar({ name }: { name: string }) {
  return (
    <span className={`avatar ${color(name)}`} aria-hidden="true">
      <Icon name="person" size={40} />
      <span className="avatar-initials">{initials(name)}</span>
    </span>
  );
}
