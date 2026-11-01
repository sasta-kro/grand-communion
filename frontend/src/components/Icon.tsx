import {
  faAddressCard,
  faBookAtlas,
  faChartLine,
  faComments,
  faFireFlameCurved,
  faFloppyDisk,
  faGear,
  faHouse,
  faLayerGroup,
  faMoon,
  faPaperPlane,
  faPlug,
  faScroll,
  faSliders,
  faUserLarge,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

const icons = {
  sessions: faLayerGroup,
  chat: faComments,
  scenarios: faBookAtlas,
  personas: faAddressCard,
  providers: faPlug,
  settings: faGear,
  controls: faSliders,
  cast: faUsers,
  recap: faScroll,
  save: faFloppyDisk,
  diagnostics: faChartLine,
  person: faUserLarge,
  send: faPaperPlane,
  lantern: faFireFlameCurved,
  observatory: faMoon,
  floodgate: faHouse,
};
export type IconName = keyof typeof icons;

/** Shared solid icons. Text beside each icon supplies its accessible label. */
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const [width, height, , , paths] = icons[name].icon;
  return (
    <svg
      className="solid-icon"
      width={size}
      height={size}
      viewBox={`0 0 ${width} ${height}`}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {(Array.isArray(paths) ? paths : [paths]).map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  );
}
