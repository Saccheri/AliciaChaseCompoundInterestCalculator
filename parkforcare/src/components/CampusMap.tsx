import { bandFor, bandLabel, type ParkForecast } from "../engine/forecast";
import { bandSurface } from "./ui";

export function CampusMap({
  parks,
  selectedId,
  onSelect,
  caption,
}: {
  parks: ParkForecast[];
  selectedId: string | null;
  onSelect?: (id: string) => void;
  caption: string;
}) {
  return (
    <div>
      <div className="relative h-72 overflow-hidden rounded-2xl border border-line sm:h-80">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <rect width="100" height="100" fill="#d7e6dc" />
          <path d="M0 86 C 22 78, 40 92, 62 84 S 100 78, 100 82 L 100 100 L 0 100 Z" fill="#b7d0dc" />
          <rect x="6" y="18" width="36" height="28" rx="1.2" fill="#fbfaf6" stroke="#1e5c4a" strokeWidth="0.6" />
          <text x="24" y="31" textAnchor="middle" fontSize="3.1" fill="#1c2b27" fontFamily="Georgia, serif">
            Outpatients
          </text>
          <text x="24" y="36" textAnchor="middle" fontSize="2.2" fill="#1e5c4a">
            illustrative entrance
          </text>
          <path d="M42 32 H 46" stroke="#1c2b27" strokeWidth="0.5" />
        </svg>
        {parks.map((park) => {
          const band = bandFor(park);
          const selected = park.park.id === selectedId;
          const className = `absolute flex flex-col items-start justify-between overflow-hidden rounded-lg p-1.5 text-left shadow-sm ${bandSurface(band)} ${
            selected ? "ring-4 ring-white ring-offset-2 ring-offset-deep" : ""
          }`;
          const style = {
            left: `${park.park.x}%`,
            top: `${park.park.y}%`,
            width: `${park.park.w}%`,
            height: `${park.park.h}%`,
          };
          const label = (
            <>
              <span className="text-[11px] font-semibold leading-tight sm:text-xs">{park.park.short}</span>
              <span className="text-[10px] leading-tight opacity-95 sm:text-[11px]">
                {bandLabel(band)}
                {park.reserved > 0 ? ` · ${park.reserved} held` : ""}
              </span>
            </>
          );
          if (!onSelect) {
            return (
              <div key={park.park.id} className={className} style={style}>
                {label}
              </div>
            );
          }
          return (
            <button
              key={park.park.id}
              type="button"
              className={className}
              style={style}
              aria-pressed={selected}
              onClick={() => onSelect(park.park.id)}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#3e534c]">{caption}</p>
      <ul className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#3e534c]">
        <li>Green plenty</li>
        <li>Amber limited</li>
        <li>Red scarce</li>
        <li>Blue protected</li>
        <li>Held count is a confirmed reservation, not a colour</li>
      </ul>
    </div>
  );
}
