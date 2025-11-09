import React, { useEffect, useMemo, useRef, useState } from "react";
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
import MenuBar from "../components/MenuBar"; // optional, if you created it earlier
import { useData } from "../backend/FetchContext";
import useWitchPath from "../backend/useWitchPath"; // runs your backend sim (logs only)

/* -------------------- Types -------------------- */
type LevelSnapshot = { timestamp: string; cauldron_levels: Record<string, number> };
type Meta = { id: string; name: string; latitude: number; longitude: number; max_volume: number };
type MarketMeta = { id: string; name: string; latitude: number; longitude: number; description: string };
type NetEdge = { from: string; to: string; travel_time_minutes: number };

type CourierEvent = { time: number; action: string; at?: string };
type CourierLog = { id: string; log: CourierEvent[] };
type SimResult = {
  success: boolean;
  minCouriers: number | null;
  finalVolumes: { id: string; volume: number }[];
  courierLogs: CourierLog[];
  toMarket: Record<string, number>;
  tOverflowMins: Record<string, number>;
};

type CauldronForecast = {
  id: string;
  name?: string;
  max: number;
  current: number;
  rate: number; // L/min
  tOverflowMin: number; // minutes until overflow from current
};

/* -------------------- Map geometry (same as Home) -------------------- */
const BASE_POS = [
  { id: "cauldron_001", x: 0.506849, y: 0.507692, icon: one },
  { id: "cauldron_002", x: 0.589041, y: 0.615385, icon: two },
  { id: "cauldron_003", x: 0.410959, y: 0.415385, icon: three },
  { id: "cauldron_004", x: 0.684932, y: 0.692308, icon: four },
  { id: "cauldron_005", x: 0.315068, y: 0.307692, icon: five },
  { id: "cauldron_006", x: 0.794521, y: 0.769231, icon: six },
  { id: "cauldron_007", x: 0.219178, y: 0.2, icon: seven },
  { id: "cauldron_008", x: 0.863014, y: 0.846154, icon: eight },
  { id: "cauldron_009", x: 0.109589, y: 0.076923, icon: nine },
  { id: "cauldron_010", x: 0.931507, y: 0.923077, icon: ten },
  { id: "cauldron_011", x: 0.0, y: 0.0, icon: eleven },
  { id: "cauldron_012", x: 1.0, y: 1.0, icon: twelve },
] as const;

const POS_BY_ID: Record<string, { x: number; y: number; icon: string }> =
  Object.fromEntries(BASE_POS.map((p) => [p.id, { x: p.x, y: p.y, icon: p.icon }])) as any;

const MARKET_POS = { x: 0.73, y: 0.12 };
const PADDING = 0.07;
const pad = (v: number) => PADDING + (1 - 2 * PADDING) * v;

const normToSvg = (x: number, y: number) => {
  const X = pad(x) * 1000;
  const Y = (1 - pad(y)) * 1000;
  return { X, Y };
};
const arcPathNorm = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lift = 180,
  prefer: "up" | "down" = "up"
) => {
  const { X: x1p, Y: y1p } = normToSvg(x1, y1);
  const { X: x2p, Y: y2p } = normToSvg(x2, y2);
  const mx = (x1p + x2p) / 2,
    my = (y1p + y2p) / 2;
  const dx = x2p - x1p,
    dy = y2p - y1p;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -(dy / len),
    ny = dx / len;
  const sign = prefer === "up" ? (ny > 0 ? -1 : 1) : ny > 0 ? 1 : -1;
  const cx = mx + nx * lift * sign;
  const cy = my + ny * lift * sign;
  return `M ${x1p},${y1p} Q ${cx},${cy} ${x2p},${y2p}`;
};

/* -------------------- Page -------------------- */
export default function Scheduling() {
  useWitchPath(); // runs your backend simulation (logs); no return, but we keep it to stay in sync with backend side-effects.

  const { data } = useData(); // level snapshots
  const [metaMap, setMetaMap] = useState<Record<string, Meta>>({});
  const [market, setMarket] = useState<MarketMeta | null>(null);
  const [edges, setEdges] = useState<NetEdge[]>([]);
  const [result, setResult] = useState<SimResult | null>(null);

  // load network + meta
  useEffect(() => {
    fetch("/seed/background_data.json")
      .then((r) => r.json())
      .then((j) => {
        const map: Record<string, Meta> = {};
        (j.cauldrons as Meta[]).forEach((c) => (map[c.id] = c));
        setMetaMap(map);
        setMarket(j.enchanted_market ?? null);
        setEdges((j.network?.edges as NetEdge[]) ?? []);
      })
      .catch(() => {
        setMetaMap({});
        setMarket(null);
        setEdges([]);
      });
  }, []);

  // derive rates (L/min) from your real data (simple slope over last ~24h window)
  const rates = useMemo<Record<string, number>>(() => {
    if (!Array.isArray(data) || data.length < 2) return {};
    // pick two far-apart snapshots to smooth noise
    const first = data[0];
    const last = data[data.length - 1];
    const t0 = Date.parse(first.timestamp);
    const t1 = Date.parse(last.timestamp);
    const mins = Math.max((t1 - t0) / 60000, 1);
    const keys = Object.keys(last.cauldron_levels ?? {});
    const out: Record<string, number> = {};
    for (const k of keys) {
      const v0 = first.cauldron_levels?.[k] ?? 0;
      const v1 = last.cauldron_levels?.[k] ?? 0;
      const slope = (v1 - v0) / mins; // L per min
      // We care about *increase toward overflow*. Clamp small negatives to 0.
      out[k] = Math.max(0, slope);
    }
    return out;
  }, [data]);

  // compute shortest to market with Dijkstra on edges
  const toMarket = useMemo<Record<string, number>>(() => {
    if (edges.length === 0) return {};
    const graph: Record<string, { node: string; cost: number }[]> = {};
    for (const e of edges) {
      (graph[e.from] ||= []).push({ node: e.to, cost: e.travel_time_minutes });
      (graph[e.to] ||= []).push({ node: e.from, cost: e.travel_time_minutes });
    }
    function dijkstra(start: string) {
      const dist: Record<string, number> = { [start]: 0 };
      const seen = new Set<string>();
      const pq: [number, string][] = [[0, start]];
      while (pq.length) {
        pq.sort((a, b) => a[0] - b[0]);
        const [d, n] = pq.shift()!;
        if (seen.has(n)) continue;
        seen.add(n);
        for (const e of graph[n] ?? []) {
          const nd = d + e.cost;
          if (dist[e.node] == null || nd < dist[e.node]) {
            dist[e.node] = nd;
            pq.push([nd, e.node]);
          }
        }
      }
      return dist;
    }
    const dist = dijkstra("market_001");
    const out: Record<string, number> = {};
    for (const id of Object.keys(metaMap)) out[id] = dist[id] ?? Infinity;
    return out;
  }, [edges, metaMap]);

  // run a quick greedy sim (24h, capacity 100) to find min number of witches
  useEffect(() => {
    if (!Object.keys(metaMap).length || !Object.keys(rates).length || !Object.keys(toMarket).length) return;
    const last = Array.isArray(data) && data.length ? data[data.length - 1] : null;

    const cauldrons = Object.keys(metaMap).map((id) => {
      const max = metaMap[id]?.max_volume ?? 800;
      const current = last?.cauldron_levels?.[id] ?? max * 0.5;
      const r = rates[id] ?? 0;
      const tOverflowMin = r > 0 ? (max - current) / r : Infinity;
      return { id, name: metaMap[id]?.name, max, current, rate: r, tOverflowMin } as CauldronForecast;
    });

    function simulate(N: number) {
      const horizon = 24 * 60;
      const cap = 100;
      const local = cauldrons.map((c) => ({ ...c }));
      const logs: CourierLog[] = Array.from({ length: N }, (_, i) => ({ id: `witch_${i + 1}`, log: [] }));
      const couriers = logs.map((l) => ({ id: l.id, state: "idle" as "idle" | "to" | "back", target: "", remain: 0 }));

      const pickUrgent = () => {
        let best: CauldronForecast | null = null;
        let minT = Infinity;
        for (const c of local) {
          const r = c.rate || 1e-9;
          const t = (c.max - c.current) / r;
          if (t < minT) {
            minT = t;
            best = c;
          }
        }
        return best;
      };

      for (let t = 0; t < horizon; t++) {
        // fill
        for (const c of local) {
          c.current += c.rate;
          if (c.current > c.max + 1e-6) {
            // overflow -> fail
            return {
              success: false,
              finalVolumes: local.map((x) => ({ id: x.id, volume: x.current })),
              courierLogs: logs,
            };
          }
        }
        // move couriers
        for (let i = 0; i < couriers.length; i++) {
          const cw = couriers[i];
          if (cw.state === "idle") continue;
          cw.remain -= 1;
          if (cw.remain <= 0) {
            if (cw.state === "to") {
              const c = local.find((x) => x.id === cw.target);
              if (c) {
                const amt = Math.min(c.current, cap);
                c.current -= amt;
                logs[i].log.push({ time: t, action: `Collected ${amt.toFixed(0)}L`, at: c.id });
                cw.state = "back";
                cw.remain = toMarket[c.id] ?? 9999; // return time
              } else {
                cw.state = "idle";
              }
            } else if (cw.state === "back") {
              logs[i].log.push({ time: t, action: `Delivered to market`, at: "market_001" });
              cw.state = "idle";
              cw.target = "";
            }
          }
        }
        // assign idle
        for (const cw of couriers) {
          if (cw.state !== "idle") continue;
          const target = pickUrgent();
          if (!target) continue;
          const tTravel = toMarket[target.id];
          if (!isFinite(tTravel)) continue;
          cw.state = "to";
          cw.target = target.id;
          cw.remain = tTravel;
          logs.find((l) => l.id === cw.id)!.log.push({ time: t, action: `Depart → ${target.id}` });
        }
      }
      return {
        success: true,
        finalVolumes: local.map((x) => ({ id: x.id, volume: x.current })),
        courierLogs: logs,
      };
    }

    let min = null as number | null;
    let best: ReturnType<typeof simulate> | null = null;
    for (let n = 1; n <= 8; n++) {
      const r = simulate(n);
      if (r.success) {
        min = n;
        best = r;
        break;
      }
    }
    // if none succeed, show last attempt
    if (!best) best = simulate(8);

    const tOverflowMins: Record<string, number> = {};
    for (const c of cauldrons)
      tOverflowMins[c.id] = c.rate > 0 ? Math.max(0, (c.max - c.current) / c.rate) : Infinity;

    setResult({
      success: !!min,
      minCouriers: min,
      finalVolumes: best!.finalVolumes,
      courierLogs: best!.courierLogs,
      toMarket,
      tOverflowMins,
    });
  }, [metaMap, rates, toMarket, data]);

  const svgRoutes = useMemo(() => {
    // build decorative route arcs from log “Depart → cauldron_X” back and forth to market
    if (!result) return [];
    const rows: { key: string; d: string }[] = [];
    const seen = new Set<string>();

    for (const l of result.courierLogs) {
      for (const ev of l.log) {
        if (ev.action.startsWith("Depart") && ev.at == null) {
          const m = ev.action.match(/→\s*(cauldron_\d+)/);
          if (!m) continue;
          const id = m[1];
          const A = POS_BY_ID[id];
          if (!A) continue;
          const { x: x1, y: y1 } = A;
          const { x: x2, y: y2 } = MARKET_POS;
          const d = arcPathNorm(x1, y1, x2, y2, 200, "up");
          const key = `${l.id}-${id}`;
          if (!seen.has(key)) {
            rows.push({ key, d });
            seen.add(key);
          }
        }
      }
    }
    return rows;
  }, [result]);

  const forecastList = useMemo<CauldronForecast[]>(() => {
    if (!metaMap || !data?.length) return [];
    const last = data[data.length - 1];
    return Object.keys(metaMap)
      .map((id) => {
        const max = metaMap[id].max_volume ?? 800;
        const current = last?.cauldron_levels?.[id] ?? max * 0.5;
        const r = rates[id] ?? 0;
        const tOverflowMin = r > 0 ? (max - current) / r : Infinity;
        return {
          id,
          name: metaMap[id]?.name,
          max,
          current,
          rate: r,
          tOverflowMin,
        };
      })
      .sort((a, b) => a.tOverflowMin - b.tOverflowMin);
  }, [metaMap, data, rates]);

  /* ------------- Render ------------- */
  if (!result)
    return (
      <div style={screen}>
        <MenuBar />
        Loading schedule…
      </div>
    );

  const minWitches = result.minCouriers ?? 8;

  return (
    <div style={root}>
      <MenuBar />
      {/* Background Map */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `url(${mapUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.25,
          pointerEvents: "none",
        }}
        aria-hidden
      />

      {/* Title row + summary */}
      <div style={topRow}>
        <div style={heroCard}>
          <div style={heroTitle}>Optimal Witch Scheduling</div>
          <div style={heroMetricWrap}>
            <div style={heroMetric}>
              <span style={heroNumber}>{minWitches}</span>
              <span style={heroLabel}>Min Witches Required</span>
            </div>
            <div style={broomWrap}>
              {Array.from({ length: minWitches }).map((_, i) => (
                <span key={i} style={broomEmoji} role="img" aria-label="broom">
                  🧹
                </span>
              ))}
            </div>
          </div>
          <div style={heroSub}>
            24-hour forecast · capacity 100 L per witch · shortest paths on network
          </div>
        </div>

        {/* Forecast list */}
        <div style={forecastCard}>
          <div style={cardTitle}>Cauldrons — Time to Overflow</div>
          <div style={{ display: "grid", gap: 8, maxHeight: 240, overflow: "auto" }}>
            {forecastList.map((c) => (
              <div key={c.id} style={forecastRow}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <img src={POS_BY_ID[c.id]?.icon} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
                  <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.name ?? c.id}
                  </div>
                </div>
                <div style={chip(c.tOverflowMin)}>
                  {isFinite(c.tOverflowMin) ? `${Math.max(0, Math.floor(c.tOverflowMin))} min` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Map overlay with animated courier routes */}
      <div style={mapCard}>
        <div style={cardTitle}>Courier Routes (first wave)</div>
        <div style={{ position: "relative", height: 380 }}>
          <svg
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            <defs>
              <linearGradient id="pathGlow" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#E9D5FF" />
                <stop offset="50%" stopColor="#C084FC" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
              <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {svgRoutes.map((r) => (
              <path
                key={r.key}
                d={r.d}
                stroke="url(#pathGlow)"
                strokeWidth={4}
                fill="none"
                filter="url(#softGlow)"
                style={{
                  strokeDasharray: 8,
                  animation: "dash 2.6s linear infinite",
                }}
              />
            ))}

            {/* Markers */}
            {BASE_POS.map((p, i) => {
              const { X, Y } = normToSvg(p.x, p.y);
              return (
                <g key={p.id} transform={`translate(${X},${Y})`}>
                  <circle r="10" fill="rgba(139,92,246,0.9)" />
                  <text
                    x={12}
                    y={4}
                    fill="#EDEAFE"
                    fontSize="12"
                    style={{ fontWeight: 700, paintOrder: "stroke", stroke: "rgba(17,17,30,.8)", strokeWidth: 2 }}
                  >
                    {p.id.split("_")[1]}
                  </text>
                </g>
              );
            })}
            {/* Market */}
            {(() => {
              const { X, Y } = normToSvg(MARKET_POS.x, MARKET_POS.y);
              return (
                <g transform={`translate(${X},${Y})`}>
                  <image href={marketIcon} width="48" height="48" x={-24} y={-24} />
                  <circle r="26" fill="none" stroke="rgba(168,85,247,.5)" strokeWidth={2} />
                </g>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* Courier timelines */}
      <div style={timelineCard}>
        <div style={cardTitle}>Witch Timelines (sample)</div>
        <div style={{ display: "grid", gap: 10 }}>
          {result.courierLogs.map((c) => (
            <div key={c.id} style={timelineRow}>
              <div style={timelineName}>{c.id}</div>
              <div style={timelineStrip}>
                {c.log.slice(0, 10).map((ev, i) => (
                  <div key={i} style={timelinePill(ev.action)}>
                    <div style={{ fontWeight: 800, fontSize: 12 }}>{minLabel(ev.action)}</div>
                    <div style={{ opacity: 0.8, fontSize: 12 }}>
                      t={ev.time}m {ev.at ? `· ${ev.at}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {result.courierLogs.length === 0 && <div style={{ opacity: 0.8 }}>No courier activity recorded.</div>}
        </div>
      </div>

      {/* Page padding */}
      <div style={{ height: 40 }} />
      <style>{keyframes}</style>
    </div>
  );
}

/* -------------------- Little helpers -------------------- */
const minLabel = (s: string) =>
  s.startsWith("Depart") ? "Depart" : s.startsWith("Collected") ? "Collect" : "Deliver";

const chip = (mins: number): React.CSSProperties => ({
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: 0.2,
  color: "#0b0e18",
  background:
    !isFinite(mins) ? "linear-gradient(180deg,#CBD5E1,#E2E8F0)" :
    mins < 60 ? "linear-gradient(180deg,#FCA5A5,#FB7185)" :
    mins < 180 ? "linear-gradient(180deg,#FDE68A,#F59E0B)" :
    "linear-gradient(180deg,#A7F3D0,#34D399)",
  border: "1px solid rgba(255,255,255,0.12)",
});

/* -------------------- Styles -------------------- */
const screen: React.CSSProperties = {
  height: "100vh",
  display: "grid",
  placeItems: "center",
  color: "white",
  background: "#0b0b0f",
};

const root: React.CSSProperties = {
  position: "relative",
  minHeight: "100vh",
  color: "white",
  padding: 24,
  display: "grid",
  gap: 20,
  background:
    "radial-gradient(1000px 700px at -10% -10%, rgba(182,156,255,0.14), transparent 60%), " +
    "radial-gradient(1000px 700px at 110% -10%, rgba(127,231,196,0.10), transparent 60%), " +
    "#0b0b0f",
};

const topRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(300px, 1fr) minmax(300px, 1fr)",
  gap: 20,
};

const cardBase: React.CSSProperties = {
  background: "linear-gradient(180deg,#17151B,#141417)",
  border: "1px solid #2a2338",
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

const heroCard: React.CSSProperties = {
  ...cardBase,
  display: "grid",
  gap: 10,
};
const heroTitle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: 0.4,
};
const heroMetricWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};
const heroMetric: React.CSSProperties = {
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  width: 180,
  height: 140,
  borderRadius: 16,
  background: "radial-gradient(160px 80px at 50% 10%, rgba(168,85,247,.35), transparent), rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
};
const heroNumber: React.CSSProperties = {
  fontSize: 56,
  fontWeight: 900,
  lineHeight: 1,
  background: "linear-gradient(180deg,#FFFFFF,#D8D8EE)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};
const heroLabel: React.CSSProperties = {
  opacity: 0.85,
  fontSize: 13,
  marginTop: 6,
  letterSpacing: 0.3,
};
const broomWrap: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
const broomEmoji: React.CSSProperties = { fontSize: 24, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.35))" };
const heroSub: React.CSSProperties = { opacity: 0.8, fontSize: 13 };

const forecastCard: React.CSSProperties = {
  ...cardBase,
  display: "grid",
  gap: 10,
};
const cardTitle: React.CSSProperties = { fontWeight: 900, letterSpacing: 0.4, marginBottom: 6 };
const forecastRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const mapCard: React.CSSProperties = { ...cardBase };
const timelineCard: React.CSSProperties = { ...cardBase };

const timelineRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  gap: 10,
  alignItems: "center",
};
const timelineName: React.CSSProperties = { fontWeight: 800, opacity: 0.9 };
const timelineStrip: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};
const timelinePill = (label: string): React.CSSProperties => ({
  padding: "8px 10px",
  borderRadius: 999,
  background:
    label.startsWith("Depart") ? "linear-gradient(180deg,#C4B5FD,#A78BFA)" :
    label.startsWith("Collect") ? "linear-gradient(180deg,#A7F3D0,#34D399)" :
    "linear-gradient(180deg,#FDE68A,#F59E0B)",
  color: "#0b0e18",
  border: "1px solid rgba(255,255,255,0.14)",
});

const keyframes = `
@keyframes dash {
  to { stroke-dashoffset: -100; }
}
`;

/* -------------------- end -------------------- */
