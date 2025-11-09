// src/pages/Home.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import mapUrl from "../assets/Map.svg";
import menuUrl from "../assets/frontpage/menu.svg";

import one from "../assets/frontpage/one.svg";
import two from "../assets/frontpage/two.svg";
import three from "../assets/frontpage/three.svg";
import four from "../assets/frontpage/four.svg";
import five from "../assets/frontpage/five.svg";
import six from "../assets/frontpage/six.svg";
import seven from "../assets/frontpage/seven.svg";
import eight from "../assets/frontpage/eight.svg";
import nine from "../assets/frontpage/nine.svg";
import ten from "../assets/frontpage/ten.svg";
import eleven from "../assets/frontpage/eleven.svg";
import twelve from "../assets/frontpage/twelve.svg";

/* ---------- Types ---------- */
type BasePos = { id: string; x: number; y: number; icon: string };
type Meta = { id: string; name: string; latitude: number; longitude: number; max_volume: number };
type Cauldron = BasePos & Partial<Meta>;
type LevelSnapshot = { timestamp: string; cauldron_levels: Record<string, number> };

/* ---------- Normalized positions (0..1), y is bottom-origin ---------- */
const BASE_POS: BasePos[] = [
  { id: "cauldron_001", x: 0.506849, y: 0.507692, icon: one },
  { id: "cauldron_002", x: 0.589041, y: 0.615385, icon: two },
  { id: "cauldron_003", x: 0.410959, y: 0.415385, icon: three },
  { id: "cauldron_004", x: 0.684932, y: 0.692308, icon: four },
  { id: "cauldron_005", x: 0.315068, y: 0.307692, icon: five },
  { id: "cauldron_006", x: 0.794521, y: 0.769231, icon: six },
  { id: "cauldron_007", x: 0.219178, y: 0.200000, icon: seven },
  { id: "cauldron_008", x: 0.863014, y: 0.846154, icon: eight },
  { id: "cauldron_009", x: 0.109589, y: 0.076923, icon: nine },
  { id: "cauldron_010", x: 0.931507, y: 0.923077, icon: ten },
  { id: "cauldron_011", x: 0.000000, y: 0.000000, icon: eleven },
  { id: "cauldron_012", x: 1.000000, y: 1.000000, icon: twelve },
];

/* ---------- Layout helpers ---------- */
const PADDING = 0.07;                                 // keep icons off the edges
const ICON_SIZE = "clamp(60px, 9.6vw, 144px)";        // 3× marker size
const pad = (v: number) => PADDING + (1 - 2 * PADDING) * v;
const fmtMDY = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
};

/* ---------- Bar row component (mini cauldron + value/ max + bar + ruler) ---------- */
function BarRow(props: {
  label: "Start" | "End";
  value?: number;
  max: number;
  iconSrc: string;
}) {
  const { label, value, max, iconSrc } = props;
  const safeMax = Math.max(1, max);
  const pct = Math.max(0, Math.min(100, ((value ?? 0) / safeMax) * 100));

  // 0%, 20%, …, 100%
  const ticks = Array.from({ length: 6 }, (_, i) => ({
    left: (i / 5) * 100,
    val: Math.round((safeMax * i) / 5),
  }));

  return (
    <div className="meter-row meter-row--icon">
      <div className="mini">
        <img src={iconSrc} alt={`${label} cauldron`} />
        <div className="mini-caption">{label}</div>
      </div>

      <div className="meter-stack">
        <div className="value-inline">
          <strong>{value !== undefined ? value.toFixed(2) : "—"}</strong> / {safeMax}
        </div>

        <div className="meter" aria-label={`${label} volume`}>
          <div className="meter-fill" style={{ width: `${pct}%` }} />
        </div>

        <div className="ruler" aria-hidden="true">
          {ticks.map((t, i) => (
            <div key={i} className="tick" style={{ left: `${t.left}%` }}>
              <span className="tick-label">{t.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =============================== Home =============================== */
export default function Home() {
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Local JSON data
  const [metaMap, setMetaMap] = useState<Record<string, Meta>>({});
  const [levels, setLevels] = useState<LevelSnapshot[]>([]);

  useEffect(() => {
    // /public/seed/background_data.json
    fetch("/seed/background_data.json")
      .then((r) => r.json())
      .then((j) => {
        const m: Record<string, Meta> = {};
        (j.cauldrons as Meta[]).forEach((c) => (m[c.id] = c));
        setMetaMap(m);
      })
      .catch(() => setMetaMap({}));

    // /public/seed/data.json (time-series snapshots)
    fetch("/seed/data.json")
      .then((r) => r.json())
      .then((j: LevelSnapshot[]) => setLevels(Array.isArray(j) ? j : []))
      .catch(() => setLevels([]));

    // preload tickets for later — optional
    fetch("/seed/ticket.json").catch(() => void 0);
  }, []);

  const CAULDRONS: Cauldron[] = useMemo(
    () => BASE_POS.map((b) => ({ ...b, ...metaMap[b.id] })),
    [metaMap]
  );

  const selectedMeta = selectedId ? metaMap[selectedId] : undefined;

  // First & last snapshots → Start/End
  const firstSnap = levels[0];
  const lastSnap = levels.length ? levels[levels.length - 1] : undefined;

  const startVal = selectedId && firstSnap ? firstSnap.cauldron_levels?.[selectedId] : undefined;
  const endVal   = selectedId && lastSnap  ? lastSnap.cauldron_levels?.[selectedId]  : undefined;

  return (
    <div
      className="screen"
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: `url(${mapUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        overflow: "hidden",
      }}
    >
      {/* Menu button + drawer */}
      <button
        className="menu-btn"
        onClick={() => setOpenDrawer(true)}
        aria-label="Open menu"
        style={{ zIndex: 50 }}
      >
        <img src={menuUrl} alt="" />
      </button>
      <div
        className={`scrim ${openDrawer ? "show" : ""}`}
        onClick={() => setOpenDrawer(false)}
        style={{ zIndex: 40 }}
      />
      <aside
        className={`drawer ${openDrawer ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        style={{ zIndex: 45 }}
      >
        <div className="drawer-header">
          <span>Menu</span>
          <button className="close" onClick={() => setOpenDrawer(false)} aria-label="Close">
            ×
          </button>
        </div>
        <nav className="nav">
          <Link to="/tracking" onClick={() => setOpenDrawer(false)}>Tracking</Link>
          <Link to="/scheduling" onClick={() => setOpenDrawer(false)}>Scheduling</Link>
        </nav>
      </aside>

      {/* Markers */}
      <div style={{ position: "absolute", inset: 0, zIndex: 10 }}>
        {CAULDRONS.map(({ id, x, y, icon, name, latitude, longitude }) => {
          const px = pad(x);
          const py = pad(y);
          return (
            <div
              key={id}
              className="marker"
              style={{
                position: "absolute",
                left: `${px * 100}%`,
                top: `${(1 - py) * 100}%`,
                transform: "translate(-50%, -50%)",
                pointerEvents: "auto",
                zIndex: 10,
                cursor: "pointer",
              }}
              onClick={() => setSelectedId(id)}
            >
              <img
                src={icon}
                alt={name ?? id}
                style={{
                  width: ICON_SIZE,
                  height: ICON_SIZE,
                  objectFit: "contain",
                  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))",
                  userSelect: "none",
                  display: "block",
                }}
              />
              {/* Tight tooltip (CSS controls proximity) */}
              <div className="tooltip">
                <div style={{ fontWeight: 800, fontSize: 16 }}>{name ?? id}</div>
                {latitude !== undefined && longitude !== undefined ? (
                  <div style={{ fontSize: 14 }}>
                    lat {latitude.toFixed(6)} · lon {longitude.toFixed(6)}
                  </div>
                ) : (
                  <div style={{ color: "#f59e0b", fontWeight: 600 }}>coords unavailable</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {selectedId && selectedMeta && (() => {
        const selected = CAULDRONS.find(c => c.id === selectedId)!;
        const iconSrc = selected.icon;
        const cap = selectedMeta.max_volume || 1;

        return (
          <div className="modal-scrim" onClick={() => setSelectedId(null)}>
            <div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="modal-head">
                <div className="modal-title">
                  <div className="modal-name">{selectedMeta.name}</div>
                  <div className="modal-sub">
                    ID: {selectedId} · Max volume: {cap}
                  </div>
                </div>
                <button
                  className="modal-close"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="modal-controls">
                <div>
                  <div className="label-fixed">Start (local date):</div>
                  <code className="code-fixed">{fmtMDY(firstSnap?.timestamp)}</code>
                </div>
                <div>
                  <div className="label-fixed">End (local date):</div>
                  <code className="code-fixed">{fmtMDY(lastSnap?.timestamp)}</code>
                </div>
              </div>

              <div className="meters">
                <BarRow label="Start" value={startVal} max={cap} iconSrc={iconSrc} />
                <BarRow label="End"   value={endVal}   max={cap} iconSrc={iconSrc} />
              </div>

              {!levels.length && (
                <div className="note error">
                  Couldn’t read <code>/seed/data.json</code>. Ensure the file exists and is valid JSON.
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
