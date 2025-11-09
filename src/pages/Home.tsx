// src/pages/Home.tsx
import { useEffect, useMemo, useState, useRef, useLayoutEffect } from "react";
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
import marketIcon from "../assets/frontpage/Market.svg";
import WeekGraph from "../backend/weekGraph";
import getCauldronRates from "../backend/useCauldronRates";

/* ---------- Types ---------- */
type BasePos = { id: string; x: number; y: number; icon: string };
type Meta = { id: string; name: string; latitude: number; longitude: number; max_volume: number };
type Cauldron = BasePos & Partial<Meta>;
type LevelSnapshot = { timestamp: string; cauldron_levels: Record<string, number> };
type MarketMeta = { id: string; name: string; latitude: number; longitude: number; description: string };
type NetEdge = { from: string; to: string; travel_time_minutes: number };

/* ---------- Fixed map coordinates (0..1, y is bottom-origin) ---------- */
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

/** Market placement */
const MARKET_POS = { x: 0.73, y: 0.12 };
const MARKET_SIZE = "clamp(220px, 22vw, 420px)";

/* ---------- Layout helpers ---------- */
const PADDING = 0.07;
const ICON_SIZE = "clamp(60px, 9.6vw, 144px)";
const pad = (v: number) => PADDING + (1 - 2 * PADDING) * v;

const fmtLong = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

/* ---------- Bar row (unchanged) ---------- */
function BarRow(props: { label: "Start" | "End"; value?: number; max: number; iconSrc: string }) {
  const { label, value, max, iconSrc } = props;
  const safeMax = Math.max(1, max);
  const pct = Math.max(0, Math.min(100, ((value ?? 0) / safeMax) * 100));
  const ticks = Array.from({ length: 6 }, (_, i) => ({ left: (i / 5) * 100, val: Math.round((safeMax * i) / 5) }));
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

/* ===================== NEW: arc helpers using same normalized positions ===================== */
const POS_BY_ID: Record<string, { x: number; y: number }> =
  Object.fromEntries(BASE_POS.map(p => [p.id, { x: p.x, y: p.y }])) as Record<string, { x: number; y: number }>;

const normToSvg = (x: number, y: number) => {
  // exactly the same mapping used for markers: padding + bottom-origin => SVG 1000x1000 space
  const X = pad(x) * 1000;
  const Y = (1 - pad(y)) * 1000;
  return { X, Y };
};

// Single-control quadratic arc. `lift` controls how “tall” the arc is.
const arcPathNorm = (
  x1: number, y1: number,
  x2: number, y2: number,
  lift = 180,
  prefer: "up" | "down" = "up"
) => {
  const { X: x1p, Y: y1p } = normToSvg(x1, y1);
  const { X: x2p, Y: y2p } = normToSvg(x2, y2);

  const mx = (x1p + x2p) / 2, my = (y1p + y2p) / 2;
  const dx = x2p - x1p, dy = y2p - y1p;
  const len = Math.hypot(dx, dy) || 1;

  // perpendicular unit normal
  const nx = -(dy / len), ny = (dx / len);

  // SVG y increases downward. For “up”, we want the control point to end up
  // with smaller Y than the midpoint => move opposite the sign of ny when ny>0.
  const sign = prefer === "up" ? (ny > 0 ? -1 : 1) : (ny > 0 ? 1 : -1);

  const cx = mx + nx * lift * sign;
  const cy = my + ny * lift * sign;

  return `M ${x1p},${y1p} Q ${cx},${cy} ${x2p},${y2p}`;
};

// keep this helper the same, just pass "up"
const arcPathById = (fromId: string, toId: string, lift = 180) => {
  const a = POS_BY_ID[fromId];
  const b = toId === "market_001" ? MARKET_POS : POS_BY_ID[toId];
  return arcPathNorm(a.x, a.y, b.x, b.y, lift, "up");
};

// add tiny helper to show number in parentheses
const cauldronNum = (id: string) => {
  const m = id.match(/^cauldron_(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
};

/* =============================== Home =============================== */
export default function Home() {
  const [openDrawer, setOpenDrawer] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Local JSON data
  const [metaMap, setMetaMap] = useState<Record<string, Meta>>({});
  const [levels, setLevels] = useState<LevelSnapshot[]>([]);
  const [marketMeta, setMarketMeta] = useState<MarketMeta | null>(null);
  const [netEdges, setNetEdges] = useState<NetEdge[]>([]); // << pathways source
  const [showTimeGraph, setShowTimeGraph] = useState(false);

  // --- measure exact centers for straight market lines
  const stageRef = useRef<HTMLDivElement | null>(null);
  const marketRef = useRef<HTMLDivElement | null>(null);
  const markerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [edges, setEdges] = useState<{ id: string; x1: number; y1: number; x2: number; y2: number }[]>([]);
  const [svgSize, setSvgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const averageRates = getCauldronRates(levels);


  useEffect(() => {
    fetch("/seed/background_data.json")
      .then((r) => r.json())
      .then((j) => {
        const m: Record<string, Meta> = {};
        (j.cauldrons as Meta[]).forEach((c) => (m[c.id] = c));
        setMetaMap(m);
        setMarketMeta((j.enchanted_market as MarketMeta) ?? null);
        // pathways
        const edges: NetEdge[] = (j.network?.edges as NetEdge[]) ?? [];
        setNetEdges(edges);
      })
      .catch(() => {
        setMetaMap({});
        setMarketMeta(null);
        setNetEdges([]);
      });

    fetch("/api/Data/?start_date=0&end_date=1762629770")
      .then((r) => r.json())
      .then((j: LevelSnapshot[]) => setLevels(Array.isArray(j) ? j : []))
      .catch(() => setLevels([]));

    fetch("/api/Tickets").catch(() => void 0);
  }, []);

  const CAULDRONS: Cauldron[] = useMemo(() => BASE_POS.map((b) => ({ ...b, ...metaMap[b.id] })), [metaMap]);

  // First/last snapshots for modal
  const firstSnap = levels[0];
  const lastSnap = levels.length ? levels[levels.length - 1] : undefined;

  const selectedMeta = selectedId ? metaMap[selectedId] : undefined;
  const startVal = selectedId && firstSnap ? firstSnap.cauldron_levels?.[selectedId] : undefined;
  const endVal = selectedId && lastSnap ? lastSnap.cauldron_levels?.[selectedId] : undefined;

  // recompute line endpoints from DOM centers (straight market lines)  **UNCHANGED**
  const recomputeEdges = () => {
    const cont = stageRef.current;
    const mEl = marketRef.current;
    if (!cont || !mEl) return;

    const cRect = cont.getBoundingClientRect();
    const mRect = mEl.getBoundingClientRect();
    const mx = mRect.left - cRect.left + mRect.width / 2;
    const my = mRect.top - cRect.top + mRect.height / 2;

    const nextEdges: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const c of CAULDRONS) {
      const el = markerRefs.current[c.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const x = r.left - cRect.left + r.width / 2;
      const y = r.top - cRect.top + r.height / 2;
      nextEdges.push({ id: c.id, x1: x, y1: y, x2: mx, y2: my });
    }
    setSvgSize({ w: cRect.width, h: cRect.height });
    setEdges(nextEdges);
  };

  useLayoutEffect(() => {
    recomputeEdges();
    const raf = requestAnimationFrame(recomputeEdges);

    const onResize = () => recomputeEdges();
    window.addEventListener("resize", onResize);

    const RzObs: any = (window as any).ResizeObserver;
    let ro: any = null;
    if (RzObs) {
      ro = new RzObs(() => recomputeEdges());
      if (stageRef.current) ro.observe(stageRef.current);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      if (ro && stageRef.current) ro.unobserve(stageRef.current);
    };
  }, [CAULDRONS.length, marketMeta, openDrawer]);

  return (
    <div
      className="screen witch-sky"
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: `url(${mapUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        overflow: "hidden",
      }}
      ref={stageRef}
    >
      {/* Menu + drawer */}
      <button className="menu-btn" onClick={() => setOpenDrawer(true)} aria-label="Open menu" style={{ zIndex: 50 }}>
        <img src={menuUrl} alt="" />
      </button>
      <div className={`scrim ${openDrawer ? "show" : ""}`} onClick={() => setOpenDrawer(false)} style={{ zIndex: 40 }} />
      <aside className={`drawer ${openDrawer ? "open" : ""}`} role="dialog" aria-modal="true" style={{ zIndex: 45 }}>
        <div className="drawer-header">
          <span>Menu</span>
          <button className="close" onClick={() => setOpenDrawer(false)} aria-label="Close">×</button>
        </div>
        <nav className="nav">
          <Link to="/tracking" onClick={() => setOpenDrawer(false)}>Tracking</Link>
          <Link to="/scheduling" onClick={() => setOpenDrawer(false)}>Scheduling</Link>
        </nav>
      </aside>

      {/* ===== Straight lines to market (measured from centers) ===== */}
      {svgSize.w > 0 && svgSize.h > 0 && (
        <svg
          className="edge-layer"
          viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
          preserveAspectRatio="none"
          aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 6, pointerEvents: "none" }}
        >
          <defs>
            <linearGradient id="edgeGlow" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#E9D5FF" />
              <stop offset="50%" stopColor="#C084FC" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
            <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {edges.map(e => (
            <path key={`edge-${e.id}`} className="edge" d={`M ${e.x1},${e.y1} L ${e.x2},${e.y2}`} />
          ))}
        </svg>
      )}

      {/* ===== Curved arcs using normalized positions (above straight lines) ===== */}
      <svg
        className="edge-layer"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 7, pointerEvents: "none" }}
      >
        {/* Uses the same .edge CSS (stroke:url(#edgeGlow); filter:url(#softGlow)) defined in the straight-lines SVG */}
        {/* market connection you asked to add */}

        {/* cauldron ↔ cauldron arcs (requested list, with moderate lifts) */}
        <path className="edge" d={arcPathById("cauldron_001", "cauldron_002", 160)} />
        <path className="edge" d={arcPathById("cauldron_002", "cauldron_004", 170)} />
        <path className="edge" d={arcPathById("cauldron_003", "cauldron_005", 190)} />
        <path className="edge" d={arcPathById("cauldron_004", "cauldron_006", 200)} />
        <path className="edge" d={arcPathById("cauldron_005", "cauldron_012", 300)} />
        <path className="edge" d={arcPathById("cauldron_006", "cauldron_011", 300)} />
        <path className="edge" d={arcPathById("cauldron_007", "cauldron_009", 220)} />
        <path className="edge" d={arcPathById("cauldron_008", "cauldron_010", 180)} />
        <path className="edge" d={arcPathById("cauldron_009", "cauldron_011", 200)} />
        <path className="edge" d={arcPathById("cauldron_010", "cauldron_012", 180)} />
      </svg>

      {/* Cauldrons */}
      <div style={{ position: "absolute", inset: 0, zIndex: 10 }}>
        {useMemo(() => CAULDRONS, [CAULDRONS]).map(({ id, x, y, icon, name, latitude, longitude }, idx) => {
          const px = pad(x), py = pad(y);
          const delay = `${(idx % 6) * 0.25}s`;
          return (
            <div
              key={id}
              className="marker witch-anim"
              ref={(el) => (markerRefs.current[id] = el)}
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
              <span className="glow" style={{ animationDelay: delay }} aria-hidden />
              <img
                className="cauldron-img"
                src={icon}
                alt={name ?? id}
                style={{ width: ICON_SIZE, height: ICON_SIZE, objectFit: "contain", userSelect: "none", display: "block" }}
                onLoad={recomputeEdges}
              />
              <span className="bubble b1" style={{ animationDelay: delay }} aria-hidden />
              <span className="bubble b2" style={{ animationDelay: `calc(${delay} + .8s)` }} aria-hidden />
              <span className="bubble b3" style={{ animationDelay: `calc(${delay} + 1.6s)` }} aria-hidden />
              <div className="tooltip">
                <div style={{ fontWeight: 800, fontSize: 16 }}>{name ?? id}</div>
                {latitude !== undefined && longitude !== undefined ? (
                  <div style={{ fontSize: 14 }}>lat {latitude.toFixed(6)} · lon {longitude.toFixed(6)}</div>
                ) : (
                  <div style={{ color: "#f59e0b", fontWeight: 600 }}>coords unavailable</div>
                )}
              </div>
            </div>
          );
        })}

        {/* Market (lower-left, larger) */}
        {marketMeta && (
          <div
            className="marker market-pin"
            ref={marketRef}
            style={{
              position: "absolute",
              left: `${pad(MARKET_POS.x) * 100}%`,
              top: `${(1 - pad(MARKET_POS.y)) * 100}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 12,
              cursor: "default",
            }}
          >
            <span className="market-ring" aria-hidden />
            <img
              src={marketIcon}
              alt={marketMeta.name}
              style={{
                width: MARKET_SIZE,
                height: "auto",
                display: "block",
                userSelect: "none",
                filter: "drop-shadow(0 8px 22px rgba(139,92,246,.55))",
              }}
              onLoad={recomputeEdges}
            />
            <div className="tooltip">
              <div style={{ fontWeight: 800, fontSize: 16 }}>{marketMeta.name}</div>
              <div style={{ fontSize: 14 }}>
                lat {marketMeta.latitude.toFixed(6)} · lon {marketMeta.longitude.toFixed(6)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedId && selectedMeta && (() => {
        const iconSrc = (BASE_POS.find((c) => c.id === selectedId) ?? BASE_POS[0]).icon;
        const cap = selectedMeta.max_volume || 1;

        // Build pathways list for the selected cauldron (with number in parentheses)
        const rows = (netEdges || [])
          .filter(e => e.from === selectedId || e.to === selectedId)
          .map(e => {
            const neighbor = e.from === selectedId ? e.to : e.from;
            const isMarket = neighbor === "market_001";
            const label = isMarket
              ? (marketMeta?.name ?? "Enchanted Market")
              : (() => {
                  const nm = metaMap[neighbor]?.name ?? neighbor;
                  const num = cauldronNum(neighbor);
                  return num ? `${nm} (${num})` : nm;   // <<<<<<<<<< name + (number)
                })();
            const icon = isMarket
              ? marketIcon
              : (BASE_POS.find(c => c.id === neighbor)?.icon ?? one);
            return { key: `${e.from}->${e.to}`, label, icon, minutes: e.travel_time_minutes };
          });

        return (
          <>
            <div className="modal-scrim" onClick={() => setSelectedId(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="modal-head modal-head--center">
                  <button className="modal-close" onClick={() => setSelectedId(null)} aria-label="Close">×</button>
                  <div className="modal-title fancy">
                    <div className="modal-name darker">
                      <span className="spark">✦</span> {selectedMeta.name} <span className="spark">✦</span>
                    </div>
                    <div className="modal-sub">ID: {selectedId} · Max volume: {cap}</div>
                    <div className="title-rule"></div>
                  </div>
                </div>

                <div className="modal-controls controls-row">
                  <div className="date-chip">
                    <span className="cal" aria-hidden>🗓</span>
                    <span className="label">Start</span>
                    <span className="value">{fmtLong(levels[0]?.timestamp)}</span>
                  </div>
                  <div className="date-chip">
                    <span className="cal" aria-hidden>🗓</span>
                    <span className="label">End</span>
                    <span className="value">{fmtLong(levels.length ? levels[levels.length - 1].timestamp : undefined)}</span>
                  </div>
                </div>

                <div className="meters">
                  <BarRow label="Start" value={startVal} max={cap} iconSrc={iconSrc} />
                  <BarRow label="End"   value={endVal}   max={cap} iconSrc={iconSrc} />
                </div>

                {/* Pathways list */}
                <div style={{ padding: "8px 20px 20px" }}>
                  <div style={{ fontWeight: 900, letterSpacing: ".3px", marginBottom: 10 }}>Pathways</div>
                  {rows.length === 0 ? (
                    <div style={{ opacity: .8 }}>No known routes for this cauldron.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {rows.map(r => (
                        <div key={r.key} style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "rgba(139,92,246,.10)",
                          border: "1px solid rgba(139,92,246,.35)",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <img src={r.icon} alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
                            <div style={{ fontWeight: 700 }}>{r.label}</div>
                          </div>
                          <div style={{
                            fontWeight: 800,
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: "rgba(139,92,246,.18)",
                            border: "1px solid rgba(139,92,246,.35)"
                          }}>
                            {r.minutes} min
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Time graph button */}
                <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "center" }}>
                  <button
                    onClick={() => setShowTimeGraph(true)}
                    style={{
                      padding: "12px 18px",
                      borderRadius: 999,
                      fontWeight: 800,
                      letterSpacing: ".3px",
                      background: "linear-gradient(180deg, #E9D5FF, #8B5CF6)",
                      color: "#0b1020",
                      border: "1px solid rgba(0,0,0,.12)",
                      boxShadow: "0 6px 16px rgba(139,92,246,.35)",
                      cursor: "pointer"
                    }}
                  >
                    Time graph
                  </button>
                </div>
              </div>
            </div>
p
            {/* NOT Empty popup for Time graph ;) */}
            {showTimeGraph && (
            <div className="modal-scrim" onClick={() => setShowTimeGraph(false)}>
              <div 
                className="modal-card" 
                onClick={(e) => e.stopPropagation()} 
                role="dialog" 
                aria-modal="true"
                style={{ maxWidth: "600px", width: "90%" }}
              >
                <div className="modal-head modal-head--center">
                  <button className="modal-close" onClick={() => setShowTimeGraph(false)} aria-label="Close">×</button>
                  <div className="modal-title fancy">
                    <div className="modal-name darker">
                      <span className="spark">✦</span> Time Graph <span className="spark">✦</span>
                    </div>
                    <div className="title-rule"></div>
                  </div>
                </div>
                <div style={{ padding: 24 }}>
                  <WeekGraph 
                    cauldronName={selectedId} 
                    averageRate={averageRates?.[selectedId]}
                    startVolume={startVal}
                    endVolume={endVal}
                    startDate={firstSnap?.timestamp}
                    endDate={lastSnap?.timestamp}
                  />
                </div>
              </div>
            </div>
          )}
          </>
        );
      })()}
    </div>
  );
}
