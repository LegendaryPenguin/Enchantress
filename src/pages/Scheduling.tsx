// src/pages/Scheduling.tsx
import React, { useEffect, useMemo, useState } from "react";
import mapUrl from "../assets/Map.svg";
import marketIcon from "../assets/frontpage/Market.svg";

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

import { useData } from "../backend/FetchContext";
import useWitchPath from "../backend/useWitchPath";

/* ---------- Types ---------- */
type BasePos = { id: string; x: number; y: number; icon: string };
type Meta = { id: string; name: string; latitude: number; longitude: number; max_volume: number };
type Cauldron = BasePos & Partial<Meta>;
type LevelSnapshot = { timestamp: string; cauldron_levels: Record<string, number> };
type MarketMeta = { id: string; name: string; latitude: number; longitude: number; description: string };
type NetEdge = { from: string; to: string; travel_time_minutes: number };

/* ---------- Map constants ---------- */
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

const PADDING = 0.07;
const pad = (v: number) => PADDING + (1 - 2 * PADDING) * v;
const ICON_SIZE = "clamp(60px, 9.6vw, 144px)";
const MARKET_POS = { x: 0.73, y: 0.12 };
const MARKET_SIZE = "clamp(220px, 22vw, 420px)";

const POS_BY_ID: Record<string, { x: number; y: number }> =
  Object.fromEntries(BASE_POS.map((p) => [p.id, { x: p.x, y: p.y }])) as Record<string, { x: number; y: number }>;

const normToSvg = (x: number, y: number) => {
  const X = pad(x) * 1000;
  const Y = (1 - pad(y)) * 1000;
  return { X, Y };
};

const arcPathNorm = (x1: number, y1: number, x2: number, y2: number, lift = 180, prefer: "up" | "down" = "up") => {
  const { X: x1p, Y: y1p } = normToSvg(x1, y1);
  const { X: x2p, Y: y2p } = normToSvg(x2, y2);
  const mx = (x1p + x2p) / 2, my = (y1p + y2p) / 2;
  const dx = x2p - x1p, dy = y2p - y1p;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -(dy / len), ny = (dx / len);
  const sign = prefer === "up" ? (ny > 0 ? -1 : 1) : (ny > 0 ? 1 : -1);
  const cx = mx + nx * lift * sign;
  const cy = my + ny * lift * sign;
  return `M ${x1p},${y1p} Q ${cx},${cy} ${x2p},${y2p}`;
};

const arcPathById = (fromId: string, toId: string, lift = 180) => {
  const a = POS_BY_ID[fromId];
  const b = toId === "market_001" ? MARKET_POS : POS_BY_ID[toId];
  return arcPathNorm(a.x, a.y, b.x, b.y, lift, "up");
};

/* ---------- Page ---------- */
export default function Scheduling() {
  useWitchPath(); // keep backend sim logs

  const { data } = useData();
  const [metaMap, setMetaMap] = useState<Record<string, Meta>>({});
  const [marketMeta, setMarketMeta] = useState<MarketMeta | null>(null);
  const [netEdges, setNetEdges] = useState<NetEdge[]>([]);

  useEffect(() => {
    fetch("/seed/background_data.json")
      .then((r) => r.json())
      .then((j) => {
        const m: Record<string, Meta> = {};
        (j.cauldrons as Meta[]).forEach((c) => (m[c.id] = c));
        setMetaMap(m);
        setMarketMeta((j.enchanted_market as MarketMeta) ?? null);
        setNetEdges(((j.network?.edges as NetEdge[]) ?? []).slice());
      })
      .catch(() => {
        setMetaMap({});
        setMarketMeta(null);
        setNetEdges([]);
      });
  }, []);

  const CAULDRONS: Cauldron[] = useMemo(() => BASE_POS.map((b) => ({ ...b, ...metaMap[b.id] })), [metaMap]);

  /* ----- Build undirected graph & Dijkstra from market ----- */
  const toMarket: Record<string, number> = useMemo(() => {
    const g: Record<string, { node: string; cost: number }[]> = {};
    for (const e of netEdges) {
      if (!g[e.from]) g[e.from] = [];
      if (!g[e.to]) g[e.to] = [];
      g[e.from].push({ node: e.to, cost: e.travel_time_minutes });
      g[e.to].push({ node: e.from, cost: e.travel_time_minutes });
    }
    const start = "market_001";
    const times: Record<string, number> = {};
    const seen = new Set<string>();
    const pq: [number, string][] = [[0, start]];
    times[start] = 0;
    while (pq.length) {
      pq.sort((a, b) => a[0] - b[0]);
      const [t, node] = pq.shift()!;
      if (seen.has(node)) continue;
      seen.add(node);
      for (const e of g[node] || []) {
        const nt = t + e.cost;
        if (times[e.node] == null || nt < times[e.node]) {
          times[e.node] = nt;
          pq.push([nt, e.node]);
        }
      }
    }
    const out: Record<string, number> = {};
    for (const c of CAULDRONS) out[c.id] = times[c.id] ?? Infinity;
    return out;
  }, [netEdges, CAULDRONS]);

  /* ----- Estimate per-cauldron inflow rates from snapshots ----- */
  const ratesLpm: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    const snaps = (Array.isArray(data) ? data : []) as LevelSnapshot[];
    if (snaps.length >= 2) {
      const a = snaps[0], b = snaps[snaps.length - 1];
      const ta = Date.parse(a.timestamp), tb = Date.parse(b.timestamp);
      const dtMin = Math.max(1, (tb - ta) / 60000);
      const ids = Object.keys(b.cauldron_levels || {});
      for (const id of ids) {
        const va = a.cauldron_levels?.[id];
        const vb = b.cauldron_levels?.[id];
        if (typeof va === "number" && typeof vb === "number") {
          const r = (vb - va) / dtMin; // L/min (net)
          // We only care about positive fill pressure (need pickup). If negative, clamp to 0.
          out[id] = Math.max(0, r);
        }
      }
    }
    // fallback defaults for any missing
    for (const c of CAULDRONS) {
      if (!(c.id in out)) out[c.id] = 0.5; // conservative default
    }
    return out;
  }, [data, CAULDRONS]);

  /* ----- Build assignments based on required cadence ----- */
  type Assign = {
    witch: string;
    cauldron: string;
    oneWay: number;
    roundTrip: number;
    cadence: number; // minutes between visits needed to keep up (100 / rate)
    rate: number;
  };

  const assignments: Assign[] = useMemo(() => {
    // For each cauldron, compute how many witches are needed:
    // witches_needed_c = ceil( rate * roundTrip / 100 )
    // where 100 is carrying capacity per trip.
    const TURN_BUFFER = 15; // min (load/unload/staging)
    const CAPACITY = 100;   // L per trip
    const perCauldron: Assign[] = [];

    const sorted = CAULDRONS
      .filter(c => Number.isFinite(toMarket[c.id]))
      .sort((a, b) => (ratesLpm[b.id] ?? 0) - (ratesLpm[a.id] ?? 0)); // high inflow first

    let witchIdx = 1;
    for (const c of sorted) {
      const r = Math.max(0, ratesLpm[c.id] ?? 0);
      const oneWay = toMarket[c.id] ?? Infinity;
      if (!Number.isFinite(oneWay) || r === 0) continue;

      const roundTrip = oneWay * 2 + TURN_BUFFER;
      const cadence = r > 0 ? (CAPACITY / r) : Infinity; // need a visit at least every 'cadence' minutes
      const needed = Math.max(1, Math.ceil((r * roundTrip) / CAPACITY));

      for (let i = 0; i < needed; i++) {
        perCauldron.push({
          witch: `Witch ${String(witchIdx++).padStart(2, "0")}`,
          cauldron: c.id,
          oneWay,
          roundTrip,
          cadence,
          rate: r,
        });
      }
    }
    // If nothing was computed (no edges), create a single default assignment to avoid empty UI
    if (!perCauldron.length && CAULDRONS.length) {
      const id = CAULDRONS[0].id;
      const ow = Number.isFinite(toMarket[id]) ? toMarket[id] : 30;
      perCauldron.push({
        witch: "Witch 01",
        cauldron: id,
        oneWay: ow,
        roundTrip: ow * 2 + 15,
        cadence: 200,
        rate: 0.5,
      });
    }
    return perCauldron;
  }, [CAULDRONS, toMarket, ratesLpm]);

  const minWitches = assignments.length;

  /* ----- UI toggles ----- */
  const [animate, setAnimate] = useState(true);

  return (
    <div style={root}>
      <div style={titleWrap}>
        <div style={titlePill}>Scheduling & Routes</div>
        <div style={subhead}>
          Estimated minimum witches: <strong style={{ color: "#E9D5FF" }}>{minWitches}</strong>
          <span style={{ opacity: 0.75, marginLeft: 12 }}>
            (derived from travel, 100 L capacity, and inferred inflow rates)
          </span>
        </div>
      </div>

      <div style={toggleRow}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />
          Animate courier routes
        </label>
      </div>

      {/* Map */}
      <div style={stage}>
        <svg
          viewBox="0 0 1000 1000"
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
            <style>{`@keyframes dashmove{to{stroke-dashoffset:26}}`}</style>
          </defs>

          {/* show the whole network lightly */}
          {netEdges.map((e, i) => (
            <path key={i} d={arcPathById(e.from, e.to, 160)} stroke="url(#edgeGlow)" strokeOpacity={0.35} strokeWidth={2} fill="none" filter="url(#softGlow)" />
          ))}

          {/* Highlight every assignment path */}
          {assignments.map((a, i) => (
            <path
              key={`hl-${i}`}
              d={arcPathById(a.cauldron, "market_001", 260)}
              stroke="url(#edgeGlow)"
              strokeWidth={animate ? 4 : 3}
              strokeDasharray={animate ? "12 14" : "0"}
              style={{ animation: animate ? ("dashmove 2.2s linear infinite" as any) : undefined }}
              fill="none"
              filter="url(#softGlow)"
              opacity={0.95}
            />
          ))}
        </svg>

        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${mapUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: "saturate(1.05)",
          }}
        />

        {/* Cauldrons */}
        <div style={{ position: "absolute", inset: 0, zIndex: 10 }}>
          {CAULDRONS.map(({ id, x, y, icon, name }) => {
            const px = pad(x), py = pad(y);
            const assigned = assignments.some((a) => a.cauldron === id);
            return (
              <div
                key={id}
                style={{
                  position: "absolute",
                  left: `${px * 100}%`,
                  top: `${(1 - py) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  zIndex: 10,
                }}
              >
                <img
                  src={icon}
                  alt={name ?? id}
                  style={{
                    width: ICON_SIZE,
                    height: ICON_SIZE,
                    objectFit: "contain",
                    userSelect: "none",
                    display: "block",
                    filter: assigned ? "drop-shadow(0 0 18px rgba(236,72,153,.6))" : "drop-shadow(0 8px 22px rgba(139,92,246,.45))",
                  }}
                />
              </div>
            );
          })}

          {/* Market */}
          {marketMeta && (
            <div
              style={{
                position: "absolute",
                left: `${pad(MARKET_POS.x) * 100}%`,
                top: `${(1 - pad(MARKET_POS.y)) * 100}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 12,
                pointerEvents: "none",
              }}
            >
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
              />
            </div>
          )}
        </div>
      </div>

      {/* Plan panel */}
      <div style={panel}>
        <div style={{ fontWeight: 900, letterSpacing: ".3px", marginBottom: 10, textAlign: "center" }}>
          Courier Route Plan (Preview)
        </div>

        {/* Filled route rows with real numbers */}
        <div style={legendList}>
          {assignments.map((a, i) => {
            const nextEta = Math.round((i * 5) % a.cadence); // stagger starts
            return (
              <div key={i} style={legendRow}>
                <div style={badge}>{a.witch}</div>
                <span style={{ opacity: 0.8, fontWeight: 700 }}>↔</span>
                <div style={badgeAlt}>{a.cauldron.replace("cauldron_", "Cauldron ")}</div>
                <div style={chipInfo}>cycle {Math.round(a.roundTrip)} min</div>
                <div style={chipInfo}>cadence ≤ {Math.max(1, Math.round(a.cadence))} min</div>
                <div style={timeChip}>next visit in {nextEta} min</div>
              </div>
            );
          })}
        </div>

        {/* Gantt-ish schedule using each witch's actual cycle time */}
        <div style={{ marginTop: 16, fontWeight: 800, opacity: 0.9, textAlign: "center" }}>24-hour Cycle Preview</div>
        <div style={ganttWrap}>
          {assignments.map((a, i) => {
            const cycle = Math.max(10, a.roundTrip);
            const startOffset = (i * 5) % cycle; // staggered
            const blocks: { start: number; dur: number }[] = [];
            for (let t = startOffset; t < 24 * 60; t += cycle) {
              blocks.push({ start: t, dur: Math.min(cycle, 90) }); // visual block
            }
            return (
              <div key={`row-${i}`} style={ganttRow}>
                <div style={ganttLabel}>{a.witch}</div>
                <div style={ganttLine}>
                  {blocks.map((b, j) => {
                    const left = (b.start / (24 * 60)) * 100;
                    const width = (b.dur / (24 * 60)) * 100;
                    return <div key={j} style={{ ...ganttBlock, left: `${left}%`, width: `${width}%` }} />;
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12, textAlign: "center" }}>
          Formula: witches per cauldron = ⌈ rate × roundTrip / 100 ⌉ · roundTrip = 2×(shortest to market) + 15 (turn).
        </div>
      </div>
    </div>
  );
}

/* ---------- Styles ---------- */
const root: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  color: "white",
  background:
    "radial-gradient(1000px 700px at -10% -10%, rgba(182,156,255,0.14), transparent 60%), " +
    "radial-gradient(1000px 700px at 110% -10%, rgba(127,231,196,0.10), transparent 60%), " +
    "#0b0b0b",
  display: "grid",
  gridTemplateRows: "auto auto 1fr auto",
  gap: 10,
  padding: 16,
};

const titleWrap: React.CSSProperties = { display: "grid", gap: 6, alignContent: "start" };
const titlePill: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 999,
  fontWeight: 900,
  letterSpacing: ".3px",
  background: "linear-gradient(180deg,#E9D5FF,#8B5CF6)",
  color: "#0b0e18",
  border: "1px solid rgba(0,0,0,.12)",
  width: "fit-content",
  boxShadow: "0 6px 16px rgba(139,92,246,.35)",
};
const subhead: React.CSSProperties = { fontSize: 14, opacity: 0.9 };
const toggleRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 16 };

const stage: React.CSSProperties = {
  position: "relative",
  minHeight: 400,
  borderRadius: 16,
  overflow: "hidden",
  border: "1px solid #2a2338",
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

const panel: React.CSSProperties = {
  background: "linear-gradient(180deg,#17151B,#141417)",
  border: "1px solid #2a2338",
  borderRadius: 14,
  padding: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

const legendList: React.CSSProperties = { display: "grid", gap: 8 };
const legendRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto auto auto auto auto auto",
  alignItems: "center",
  gap: 10,
};

const badge: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 800,
  letterSpacing: ".3px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  width: "fit-content",
};
const badgeAlt: React.CSSProperties = { ...badge, background: "rgba(139,92,246,.14)", border: "1px solid rgba(139,92,246,.35)" };
const chipInfo: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  fontWeight: 800,
  width: "fit-content",
};
const timeChip: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 999,
  background: "rgba(139,92,246,.18)",
  border: "1px solid rgba(139,92,246,.35)",
  fontWeight: 800,
  width: "fit-content",
  justifySelf: "end",
};

const ganttWrap: React.CSSProperties = { marginTop: 8, display: "grid", gap: 6 };
const ganttRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 10 };
const ganttLabel: React.CSSProperties = { fontWeight: 800, opacity: 0.9 };
const ganttLine: React.CSSProperties = {
  position: "relative",
  height: 18,
  borderRadius: 8,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  overflow: "hidden",
};
const ganttBlock: React.CSSProperties = {
  position: "absolute",
  top: 2,
  height: 14,
  borderRadius: 7,
  background: "linear-gradient(180deg,#E9D5FF,#8B5CF6)",
  boxShadow: "0 6px 12px rgba(139,92,246,.35)",
};
