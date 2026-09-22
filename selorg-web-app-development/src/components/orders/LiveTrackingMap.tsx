/** Waypoints of the illustrated delivery route, in the 310×260 SVG viewBox. */
const WAY: [number, number][] = [
  [42, 232],
  [92, 232],
  [92, 168],
  [156, 168],
  [156, 108],
  [214, 108],
  [214, 62],
  [268, 62],
];

function clamp01(t: number): number {
  return Math.max(0, Math.min(0.999, t));
}

function riderAt(t: number): { x: number; y: number } {
  const segs = WAY.length - 1;
  const pos = clamp01(t) * segs;
  const i = Math.floor(pos);
  const f = pos - i;
  const a = WAY[i]!;
  const b = WAY[i + 1] ?? a;
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f };
}

const ROUTE_D = WAY.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");

function traveledD(t: number): string {
  const segs = WAY.length - 1;
  const i = Math.floor(clamp01(t) * segs);
  const head = riderAt(t);
  const pts: [number, number][] = [...WAY.slice(0, i + 1), [head.x, head.y]];
  return pts
    .map((q, k) => `${k ? "L" : "M"}${Math.round(q[0] * 10) / 10} ${Math.round(q[1] * 10) / 10}`)
    .join(" ");
}

const ROUTE_LEN = WAY.reduce(
  (sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p[0] - WAY[i - 1]![0], p[1] - WAY[i - 1]![1])),
  0,
);

/**
 * Illustrated live-tracking map, ported from the design source.
 *
 * The artwork is a stylised neighbourhood, not a real basemap, so the rider
 * marker is driven by route progress rather than by raw lat/lng — plotting real
 * coordinates onto fictional streets would be meaningless. When the backend is
 * streaming a rider position we say so in the subtitle instead.
 */
export function LiveTrackingMap({
  progress,
  etaSecs,
  riderLat,
  riderLng,
}: {
  progress: number;
  etaSecs: number;
  riderLat?: number;
  riderLng?: number;
}) {
  const mins = etaSecs > 0 ? Math.max(1, Math.ceil(etaSecs / 60)) : null;
  const pct = Math.round(progress * 100);
  const hasGps = riderLat != null && riderLng != null;
  const rider = riderAt(progress);
  const kmLeft = Math.max(0.1, (ROUTE_LEN * (1 - clamp01(progress))) / 42).toFixed(1);

  return (
    <div className="overflow-hidden rounded-app border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-[22px] py-[18px]">
        <div>
          <div className="text-[15px] font-extrabold">Live tracking</div>
          <div className="mt-0.5 text-[12.5px] text-muted">
            {hasGps ? "Rider location updated · " : `${kmLeft} km away · `}
            {pct}% of the route covered
          </div>
        </div>
        {mins != null ? (
          <div className="text-right">
            <div className="text-[11px] font-semibold text-muted">ARRIVING IN</div>
            <div className="font-sans text-[22px] font-extrabold leading-none text-accent-dark">
              {mins} min
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative bg-[#eaeee4]">
        <svg viewBox="0 0 310 260" className="block h-auto w-full">
          <defs>
            <filter id="mkShadow" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1.4" stdDeviation="1.6" floodColor="#1d2a12" floodOpacity="0.34" />
            </filter>
          </defs>

          <rect x="0" y="0" width="310" height="260" fill="#f3f1e8" />
          <path d="M0 0H120V44H196V0H310V26H236V72H130V30H0Z" fill="#e9ecdd" opacity="0.55" />

          {/* Park */}
          <path d="M0 186H74V260H0Z" fill="#d9e7c6" />
          <path d="M18 196h44M18 208h44M18 220h44" stroke="#c9dbb1" strokeWidth="1.4" fill="none" />
          <text x="26" y="243" fontSize="7.5" fontWeight="600" fill="#7c9059" fontFamily="system-ui" letterSpacing="0.4">
            CITY PARK
          </text>

          {/* Lake */}
          <path d="M236 176H310V232H236Z" fill="#cfe0e9" />
          <text x="250" y="206" fontSize="7" fontWeight="600" fill="#6d8d9c" fontFamily="system-ui">
            LAKE
          </text>

          {/* Buildings */}
          <g fill="#e4e1d5">
            <rect x="10" y="12" width="34" height="30" rx="2" />
            <rect x="50" y="12" width="30" height="18" rx="2" />
            <rect x="50" y="34" width="30" height="20" rx="2" />
            <rect x="104" y="12" width="40" height="24" rx="2" />
            <rect x="150" y="12" width="52" height="34" rx="2" />
            <rect x="104" y="42" width="24" height="26" rx="2" />
            <rect x="224" y="14" width="34" height="22" rx="2" />
            <rect x="276" y="14" width="26" height="34" rx="2" />
            <rect x="104" y="80" width="42" height="34" rx="2" />
            <rect x="168" y="76" width="34" height="22" rx="2" />
            <rect x="230" y="86" width="46" height="30" rx="2" />
            <rect x="10" y="80" width="30" height="34" rx="2" />
            <rect x="52" y="86" width="28" height="28" rx="2" />
            <rect x="12" y="126" width="34" height="42" rx="2" />
            <rect x="54" y="126" width="26" height="26" rx="2" />
            <rect x="104" y="126" width="36" height="30" rx="2" />
            <rect x="150" y="130" width="46" height="26" rx="2" />
            <rect x="230" y="128" width="30" height="26" rx="2" />
            <rect x="104" y="186" width="44" height="34" rx="2" />
            <rect x="158" y="190" width="38" height="26" rx="2" />
            <rect x="104" y="228" width="60" height="24" rx="2" />
            <rect x="176" y="228" width="44" height="24" rx="2" />
            <rect x="176" y="126" width="26" height="26" rx="2" />
          </g>

          {/* Road casings */}
          <g fill="none" stroke="#e6e2d4" strokeLinecap="round">
            <path d="M0 232H310" strokeWidth="17" />
            <path d="M214 0V260" strokeWidth="17" />
            <path d="M0 108H310" strokeWidth="13" />
            <path d="M92 0V260" strokeWidth="13" />
            <path d="M0 168H310" strokeWidth="11" />
            <path d="M0 62H310" strokeWidth="11" />
            <path d="M156 0V260" strokeWidth="11" />
            <path d="M268 0V260" strokeWidth="11" />
            <path d="M42 0V260" strokeWidth="10" />
          </g>
          <g fill="none" stroke="#ffffff" strokeLinecap="round">
            <path d="M0 232H310" strokeWidth="13" />
            <path d="M214 0V260" strokeWidth="13" />
            <path d="M0 108H310" strokeWidth="9.5" />
            <path d="M92 0V260" strokeWidth="9.5" />
            <path d="M0 168H310" strokeWidth="7.5" />
            <path d="M0 62H310" strokeWidth="7.5" />
            <path d="M156 0V260" strokeWidth="7.5" />
            <path d="M268 0V260" strokeWidth="7.5" />
            <path d="M42 0V260" strokeWidth="6.5" />
          </g>
          <g fill="none" stroke="#f0c86a" strokeWidth="1.1" strokeDasharray="5 5" opacity="0.85">
            <path d="M0 232H310" />
            <path d="M214 0V260" />
          </g>
          <g fontFamily="system-ui" fontSize="6.5" fontWeight="600" fill="#a8a596" letterSpacing="0.5">
            <text x="8" y="230.4">100 FT ROAD</text>
            <text x="120" y="106.3">12TH MAIN</text>
            <text x="8" y="166.3">5TH CROSS</text>
            <text x="218" y="20" transform="rotate(90 218 20)">CMH ROAD</text>
          </g>

          {/* Route + traveled path */}
          <path
            d={ROUTE_D}
            stroke="#b9c3a6"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="7 6"
            opacity="0.9"
          />
          <path
            d={traveledD(progress)}
            stroke="#446a20"
            strokeWidth="6.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.28"
          />
          <path
            d={traveledD(progress)}
            stroke="#5E8C3A"
            strokeWidth="4.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Store */}
          <g filter="url(#mkShadow)">
            <circle cx="42" cy="232" r="8.5" fill="#fff" stroke="#446a20" strokeWidth="3" />
            <circle cx="42" cy="232" r="2.6" fill="#446a20" />
          </g>
          <g filter="url(#mkShadow)">
            <rect x="15" y="242" width="54" height="14" rx="7" fill="#fff" />
          </g>
          <text x="42" y="251.8" textAnchor="middle" fontSize="8" fontWeight="800" fill="#3d4636" fontFamily="system-ui">
            Selorg Store
          </text>

          {/* Destination */}
          <g filter="url(#mkShadow)">
            <path
              d="M268 74c-6.4-7.6-9.6-12.2-9.6-16.6a9.6 9.6 0 0 1 19.2 0c0 4.4-3.2 9-9.6 16.6z"
              fill="#446a20"
            />
            <circle cx="268" cy="57" r="3.6" fill="#fff" />
          </g>
          <g filter="url(#mkShadow)">
            <rect x="248" y="30" width="40" height="14" rx="7" fill="#446a20" />
          </g>
          <text x="268" y="39.8" textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff" fontFamily="system-ui">
            You
          </text>

          {/* Rider */}
          <g transform={`translate(${rider.x},${rider.y})`}>
            <circle r="20" fill="#5E8C3A" opacity="0.14">
              <animate attributeName="r" values="12;22;12" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.22;0.02;0.22" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle r="12.5" fill="#fff" filter="url(#mkShadow)" />
            <circle r="12.5" fill="none" stroke="#5E8C3A" strokeWidth="2.4" />
            <g
              stroke="#446a20"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(-6.5,-6)"
            >
              <path d="M3.2 9.4h4.2l1.6-3.2h2.4" />
              <path d="M4.6 6.2h3l1 3.2" />
              <circle cx="2.6" cy="10.2" r="1.9" />
              <circle cx="10.4" cy="10.2" r="1.9" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
