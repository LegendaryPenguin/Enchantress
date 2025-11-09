// src/pages/Tracking.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import explodeSvg from "../assets/second/explode.svg";
import notexplodeSvg from "../assets/second/not_explode.svg";
import menuSvg from "../assets/frontpage/menu.svg";
import { useData } from "../backend/FetchContext";
import { getDiscrepancyCheck } from "../backend/getDiscrepancyCheck";
import bgTrack from "../assets/second/background_twoo.svg";

/* ===== Types from discrepancy output ===== */
type DiscEvent = {
  timestamp: string;        // ISO
  error_type: string;
  volume_diff: number;
  cauldron_id: string;
  lost_amount: number;
};
type DiscMap = Record<string, DiscEvent[]>;

/* ===== Helpers (LOCAL time) ===== */
const pad2 = (n: number) => String(n).padStart(2, "0");
const localDateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Format a YYYY-MM-DD (interpreted as a local calendar day)
function formatPrettyDate(isoYYYYMMDD: string) {
  const [y, m, d] = isoYYYYMMDD.split("-").map(Number);
  const dt = new Date((y ?? 1970), (m ?? 1) - 1, (d ?? 1));
  return dt.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

// Format a timestamp as local time (e.g., "07:58 PM")
function formatTimeLocal(iso: string) {
  const dt = new Date(iso);
  return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// inclusive LOCAL range between two Dates
function buildDateRangeLocal(start: Date, end: Date): string[] {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const out: string[] = [];
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) out.push(localDateKey(d));
  return out;
}

// Turn ISO -> local date key "YYYY-MM-DD"
function tsToLocalDateKey(ts: string) {
  const d = new Date(ts);
  return localDateKey(d);
}

/* ===== Page ===== */
export default function Tracking() {
  const [openDrawer, setOpenDrawer] = useState(false);

  const { data, ticketData } = useData();
  const [discByCauldron, setDiscByCauldron] = useState<DiscMap>({});
  const [ready, setReady] = useState(false);

  const cauldronIds = useMemo<string[]>(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    return Object.keys(data[0]?.cauldron_levels ?? {}).sort();
  }, [data]);

  // Load discrepancy events (accepts array or {discrepancies} map or per-cauldron)
  useEffect(() => {
    if (!Array.isArray(data) || data.length === 0) return;

    let mapped: DiscMap = {};
    try {
      const r: any = getDiscrepancyCheck(data, ticketData);
      if (r?.discrepancies && typeof r.discrepancies === "object") {
        mapped = r.discrepancies as DiscMap;
      } else if (Array.isArray(r)) {
        const tmp: DiscMap = {};
        for (const ev of r as DiscEvent[]) (tmp[ev.cauldron_id] ||= []).push(ev);
        mapped = tmp;
      } else if (r && typeof r === "object") {
        mapped = r as DiscMap;
      }

      // Fallback per-cauldron if still empty
      if (Object.keys(mapped).length === 0 && cauldronIds.length) {
        const tmp: DiscMap = {};
        for (const id of cauldronIds) {
          const x: any = getDiscrepancyCheck(data, ticketData, id);
          if (Array.isArray(x)) tmp[id] = x as DiscEvent[];
          else if (x?.discrepancies?.[id]) tmp[id] = x.discrepancies[id] as DiscEvent[];
          else tmp[id] = [];
        }
        mapped = tmp;
      }
    } catch {
      mapped = {};
    }

    setDiscByCauldron(mapped);
    setReady(true);
  }, [data, ticketData, cauldronIds]);

  // Build date strip from earliest -> latest LOCAL day across telemetry + disc events
  const dateList = useMemo<string[]>(() => {
    if (!Array.isArray(data) || data.length === 0) return [];

    const times: Date[] = [];
    for (const row of data) times.push(new Date(String(row.timestamp)));
    for (const id of Object.keys(discByCauldron)) {
      for (const ev of discByCauldron[id]) times.push(new Date(ev.timestamp));
    }
    if (times.length === 0) return [];

    times.sort((a, b) => a.getTime() - b.getTime());
    const start = times[0];
    const end = times[times.length - 1];
    return buildDateRangeLocal(start, end);
  }, [data, discByCauldron]);

  if (!ready) return <Screen>Loading…</Screen>;
  if (cauldronIds.length === 0 || dateList.length === 0) return <Screen>No data</Screen>;

  return (
    <div style={root}>
      {/* ===== Menu + drawer (same pattern as Home.tsx) ===== */}
      <button className="menu-btn" onClick={() => setOpenDrawer(true)} aria-label="Open menu" style={{ zIndex: 50 }}>
        <img src={menuSvg} alt="" />
      </button>
      <div className={`scrim ${openDrawer ? "show" : ""}`} onClick={() => setOpenDrawer(false)} style={{ zIndex: 40 }} />
      <aside className={`drawer ${openDrawer ? "open" : ""}`} role="dialog" aria-modal="true" style={{ zIndex: 45 }}>
        <div className="drawer-header">
          <span>Menu</span>
          <button className="close" onClick={() => setOpenDrawer(false)} aria-label="Close">×</button>
        </div>
        <nav className="nav">
          <Link to="/" onClick={() => setOpenDrawer(false)}>Home</Link>
          <Link to="/tracking" onClick={() => setOpenDrawer(false)}>Tracking</Link>
          <Link to="/scheduling" onClick={() => setOpenDrawer(false)}>Scheduling</Link>
        </nav>
      </aside>

      {/* Inline CSS used by the menu & custom scrollbar */}
      <style>{`
        .menu-btn{position:absolute;top:16px;left:16px;width:44px;height:44px;padding:6px;border:none;border-radius:10px;background:rgba(255,255,255,.18);backdrop-filter:blur(2px);cursor:pointer;z-index:20;transition:all .2s}
        .menu-btn:hover{background:rgba(255,255,255,.25);transform:scale(1.05)}
        .menu-btn img{width:100%;height:100%;display:block}

        .scrim{position:fixed;inset:0;background:rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .2s}
        .scrim.show{opacity:1;pointer-events:auto}
        .drawer{position:fixed;top:0;left:0;bottom:0;width:280px;background:#17151B;transform:translateX(-100%);transition:transform .3s;border-right:1px solid #2a2338;box-shadow:4px 0 24px rgba(0,0,0,.25)}
        .drawer.open{transform:translateX(0)}
        .drawer-header{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid #2a2338;font-weight:700;font-size:18px;letter-spacing:.3px}
        .drawer-header .close{border:none;background:none;color:inherit;font-size:24px;cursor:pointer;padding:8px;margin:-8px;opacity:.8}
        .drawer-header .close:hover{opacity:1}
        .nav{padding:12px 0}
        .nav a{display:block;padding:12px 24px;color:inherit;text-decoration:none;font-weight:600;letter-spacing:.2px;transition:background-color .15s}
        .nav a:hover{background:rgba(255,255,255,.05)}

        .witchy-scroll{scrollbar-width:thin;scrollbar-color:#a78bfa1f transparent}
        .witchy-scroll::-webkit-scrollbar{width:10px;height:10px}
        .witchy-scroll::-webkit-scrollbar-track{background:linear-gradient(180deg,rgba(167,139,250,.10),rgba(59,7,100,.14));border-radius:999px;box-shadow:inset 0 0 6px rgba(0,0,0,.35)}
        .witchy-scroll::-webkit-scrollbar-thumb{border-radius:999px;background:linear-gradient(180deg,#c084fc,#9333ea);border:2px solid rgba(16,16,20,.6);box-shadow:0 0 10px rgba(168,85,247,.55), inset 0 0 6px rgba(255,255,255,.18)}
        .witchy-scroll::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,#d8b4fe,#a855f7);box-shadow:0 0 14px rgba(192,132,252,.75), inset 0 0 8px rgba(255,255,255,.22)}
        .witchy-scroll::-webkit-scrollbar-corner{background:transparent}
      `}</style>

      <div style={titleBox}>
        <h1 style={title}>Daily Discrepancy Tracker</h1>
      </div>

      <div style={rows} className="witchy-scroll">
        {cauldronIds.map((id) => (
          <div key={id} style={card}>
            <div style={cardHead}>
              <div style={{ fontWeight: 700, letterSpacing: 0.2 }}>{id}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                {dateList[0]} → {dateList[dateList.length - 1]}
              </div>
            </div>

            {/* Per-cauldron horizontal scroller (first date fully visible; scroll to the right) */}
            <div style={daysScroller} className="witchy-scroll">
              <div style={daysStrip}>
                {dateList.map((iso) => {
                  const events = (discByCauldron[id] || [])
                    .filter((ev) => tsToLocalDateKey(ev.timestamp) === iso)
                    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
                  return <DayCard key={`${id}-${iso}`} iso={iso} events={events} />;
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== DayCard (back lists events; green shows “No discrepancies”) ===== */
function DayCard({ iso, events }: { iso: string; events: DiscEvent[] }) {
  const [flipped, setFlipped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hasDisc = events.length > 0;
  const iconSrc = hasDisc ? explodeSvg : notexplodeSvg;

  const outlineColor = hasDisc
    ? "2px solid rgba(246,115,185,0.72)"
    : "2px solid rgba(150,242,215,0.60)";
  const boxShadow = hasDisc
    ? "0 8px 18px rgba(246,115,185,0.18), 0 2px 6px rgba(246,115,185,0.22)"
    : "0 8px 18px rgba(150,242,215,0.10), 0 2px 6px rgba(150,242,215,0.16)";
  const pretty = formatPrettyDate(iso);

  const onToggle = () => setFlipped((v) => !v);
  const onKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); }
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={flipped}
      aria-label={`Details for ${pretty}`}
      style={{
        all: "unset",
        cursor: "pointer",
        ...outlineWrap,
        border: outlineColor,
        boxShadow,
        transform: hovered ? "scale(1.06)" : "scale(1)",
        transition: "transform 160ms ease, box-shadow 160ms ease",
        willChange: "transform",
        scrollSnapAlign: "start",
      }}
    >
      <div style={flipWrap}>
        <div style={{ ...flipInner, transform: flipped ? "rotateY(180deg)" : "none" }}>
          {/* Front */}
          <div style={frontFace}>
            <div style={frontCenter}>
              <img src={iconSrc} alt={hasDisc ? "discrepancy" : "ok"} style={iconImg} />
              <div style={datePillWrap}>
                <div style={{ position: "relative" }}>
                  <div style={dateHalo} />
                  <div style={datePill}>{pretty}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Back */}
          <div style={backFace}>
            <div style={backBody}>
              {hasDisc ? (
                <div style={{ display: "grid", gap: 8, maxHeight: 180, overflowY: "auto" }} className="witchy-scroll">
                  {events.map((ev, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        textAlign: "left",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          fontWeight: 800,
                          fontSize: 13,
                          boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
                          background: "linear-gradient(180deg,#FFAFF1,#F673B9)",
                          color: "#131318",
                          width: "fit-content",
                          marginBottom: 6,
                        }}
                      >
                        Δ {ev.volume_diff.toFixed(2)}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 13.5 }}>
                        {formatTimeLocal(ev.timestamp)} · {ev.error_type}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    textAlign: "center",
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13.5 }}>
                    — — · No discrepancies
                  </div>
                </div>
              )}
            </div>
            <div style={backFooter}>Click to flip back</div>
          </div>
        </div>
      </div>
    </button>
  );
}

/* ===== Small components ===== */
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: "100vh",
        background: "#0b0b0b",
        color: "white",
        display: "grid",
        placeItems: "center",
        fontSize: 18,
      }}
    >
      {children}
    </div>
  );
}

/* ---------- styles ---------- */
const root: React.CSSProperties = {
  minHeight: "100vh",
  color: "white",
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 24,
  width: "100%",
  boxSizing: "border-box",
  position: "absolute",
  inset: 0,

  // base color
  backgroundColor: "#0b0b0b",

  // gradients + image
  backgroundImage: `
    radial-gradient(1000px 700px at -10% -10%, rgba(182,156,255,0.14), transparent 60%),
    radial-gradient(1000px 700px at 110% -10%, rgba(127,231,196,0.10), transparent 60%),
    url(${bgTrack})
  `,
  backgroundSize: "cover, cover, cover",
  backgroundPosition: "center, center, center",
  backgroundRepeat: "no-repeat, no-repeat, no-repeat",
};

const title: React.CSSProperties = {
  margin: 0,
  color: "black",
  fontSize: 34,
  lineHeight: 1.15,
  background: "linear-gradient(180deg,#FFFFFF,#D8D8EE)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  letterSpacing: 0.4,
};

const rows: React.CSSProperties = {
  display: "grid",
  gap: 22,
  flex: 1,
  overflowY: "auto",
  paddingRight: 8,
  justifyContent: "center",
};

const card: React.CSSProperties = {
  background: "linear-gradient(180deg,#17151B,#141417)",
  border: "1px solid #2a2338",
  borderRadius: 14,
  padding: 14,
  maxWidth: "1680px",
  margin: "0 auto",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

const cardHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 8,
  color: "#EDEAF9",
};

const daysScroller: React.CSSProperties = {
  overflowX: "auto",
  overflowY: "hidden",
  paddingBottom: 6,
  scrollPaddingLeft: 6,       // ensure first tile fully visible
};

const daysStrip: React.CSSProperties = {
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "min(12.2vw, 156px)",
  gap: 10,
  alignItems: "start",
  scrollSnapType: "x mandatory",
};

const outlineWrap: React.CSSProperties = {
  position: "relative",
  width: "min(12.2vw, 156px)",
  aspectRatio: "1 / 1",
  borderRadius: 14,
};

const flipWrap: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  perspective: "1000px",
  borderRadius: 14,
  overflow: "hidden",
};

const titleBox: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 14px",
  borderRadius: 10,
  background: "#0b0b0b",
  border: "1px solid #2a2338",
  boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
};

const flipInner: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  transition: "transform 0.45s ease",
  transformStyle: "preserve-3d",
  borderRadius: 14,
};

const faceBase: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden" as any,
  borderRadius: 14,
};

const frontFace: React.CSSProperties = {
  ...faceBase,
  background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
  display: "grid",
  placeItems: "center",
};

const backFace: React.CSSProperties = {
  ...faceBase,
  transform: "rotateY(180deg)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
  display: "grid",
  gridTemplateRows: "1fr auto",
};

const frontCenter: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
};

const iconImg: React.CSSProperties = {
  width: "94%",
  height: "94%",
  objectFit: "contain",
  transform: "translateY(-18px)",
  filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))",
};

const datePillWrap: React.CSSProperties = {
  position: "absolute",
  bottom: 31,
  left: "50%",
  transform: "translateX(-50%)",
  display: "grid",
  placeItems: "center",
};

const datePill: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 999,
  fontSize: 13.5,
  letterSpacing: 0.2,
  color: "#EEF0FF",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
  background: "linear-gradient(180deg, rgba(18,18,22,0.62), rgba(18,18,22,0.42))",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 6px 16px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.04)",
  whiteSpace: "nowrap",
};

const dateHalo: React.CSSProperties = {
  position: "absolute",
  inset: -3,
  borderRadius: 999,
  background: "radial-gradient(60% 120% at 50% 50%, rgba(168, 85, 247, 0.28), rgba(99,102,241,0.00))",
  pointerEvents: "none",
};

const backBody: React.CSSProperties = {
  padding: 10,
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  gap: 8,
  textAlign: "center",
};

const backFooter: React.CSSProperties = {
  height: 26,
  display: "grid",
  placeItems: "center",
  fontSize: 12,
  color: "#CFCFEA",
  background: "rgba(255,255,255,0.05)",
  borderTop: "1px solid rgba(255,255,255,0.06)",
};
