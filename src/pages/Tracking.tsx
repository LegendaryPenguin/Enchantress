// src/pages/Tracking.tsx
import React, { useEffect, useMemo, useState } from "react";
import explodeSvg from "../assets/second/explode.svg";
import notexplodeSvg from "../assets/second/not_explode.svg";
import { useData } from "../backend/FetchContext"
import { getDiscrepancyCheck } from "../backend/getDiscrepancyCheck"

/* ===== Types ===== */
type DayRecord = {
  date: string;          // "YYYY-MM-DD"
  ticket_id: string;
  cauldron_id: string;
  ticket_volume: number;
  drain_volume: number;
  delta: number;
  discrepancy: boolean;
};

type CauldronDays = {
  id: string;
  name?: string;
  days: DayRecord[];
};

type FakePayload = { cauldrons: CauldronDays[] };

/* ===== Helpers ===== */
function formatPrettyDate(isoYYYYMMDD: string) {
  const [y, m, d] = isoYYYYMMDD.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1); // construct from parts to avoid TZ drift
  return dt.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/* ===== Page ===== */
export default function Tracking() {
  const [dataPayload, setDataPayload] = useState<FakePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cauldronData, setCauldronData] = useState({});
  const { data, ticketData } = useData();

  useEffect(() => {
    const cauldronKeys = Object.keys(data[0].cauldron_levels);
    console.log(cauldronKeys);

    const newData: Record<string, any[]> = {};

    cauldronKeys.forEach(cauldron => {
      const discrepancies = getDiscrepancyCheck(data, ticketData, cauldron);
      newData[cauldron] = discrepancies;
    });

    setCauldronData(newData);
    
  }, [data, ticketData]);

  useEffect(() => {
    (async () => {
      try {
        // public/seed/fake.json
        const res = await fetch("/seed/fake.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();

        const tol =
          (raw?.metadata?.tolerance_liters as number | undefined) ?? 0.5;

        const cauldrons: CauldronDays[] = raw.cauldrons.map((c: any) => {
          const days: DayRecord[] = (raw.days ?? [])
            .map((d: any) => {
              const bucket =
                d.cauldrons?.[c.id] ??
                d.cauldrons?.[c.id?.replace("cauldron", "cauldrone")];
              if (!bucket) return null;

              const ticket = bucket.tickets?.[0];
              const drain = bucket.drains?.[0];
              if (!ticket || !drain) return null;

              const drainVol =
                Number(drain.level_before ?? 0) - Number(drain.level_after ?? 0);
              const ticketVol = Number(ticket.amount_collected ?? 0);
              const delta = ticketVol - drainVol;

              return {
                date: String(d.date).slice(0, 10),
                ticket_id: String(ticket.ticket_id),
                cauldron_id: String(c.id),
                ticket_volume: ticketVol,
                drain_volume: drainVol,
                delta,
                discrepancy: Math.abs(delta) > tol,
              } as DayRecord;
            })
            .filter(Boolean) as DayRecord[];

          return { id: c.id, name: c.name, days } as CauldronDays;
        });

        setDataPayload({ cauldrons });
      } catch (e: any) {
        setErr(e?.message ?? "failed to load /seed/fake.json");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cauldrons = useMemo(() => {
    if (!dataPayload) return [];
    return [...dataPayload.cauldrons].sort((a, b) => a.id.localeCompare(b.id));
  }, [dataPayload]);

  if (loading) return <Screen>Loading…</Screen>;
  if (err) return <Screen>Error: {err}</Screen>;
  if (!dataPayload || cauldrons.length === 0) return <Screen>No dataPayload</Screen>;

  return (
    <div style={root}>
      <h1 style={title}>Daily Discrepancy Tracker</h1>

      <div style={rows}>
        {cauldrons.map((c) => (
          <div key={c.id} style={card}>
            <div style={cardHead}>
              <div style={{ fontWeight: 700, letterSpacing: 0.2 }}>
                {c.name ?? c.id}
              </div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>{c.id}</div>
            </div>

            {/* 7 responsive squares; no horizontal scroll */}
            <div style={daysGrid}>
              {Array.from({ length: 7 }).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                const iso = d.toISOString().slice(0, 10);
                const rec = c.days.find((x) => x.date === iso);
                return <DayCard key={`${c.id}-${iso}`} iso={iso} rec={rec} />;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== DayCard (entire card flips; outline persists) ===== */
type DayCardProps = { iso: string; rec: DayRecord | undefined };

function DayCard({ iso, rec }: DayCardProps) {
  const [flipped, setFlipped] = useState(false);
  const isDisc = !!rec?.discrepancy;
  const iconSrc = isDisc ? explodeSvg : notexplodeSvg;

  const outlineColor = isDisc
    ? "2px solid rgba(246,115,185,0.72)"
    : "2px solid rgba(150,242,215,0.60)";

  const boxShadow = isDisc
    ? "0 8px 18px rgba(246,115,185,0.18), 0 2px 6px rgba(246,115,185,0.22)"
    : "0 8px 18px rgba(150,242,215,0.10), 0 2px 6px rgba(150,242,215,0.16)";

  const deltaBg = isDisc
    ? "linear-gradient(180deg,#FFAFF1,#F673B9)"
    : "linear-gradient(180deg,#A6F7E3,#7FE7C4)";

  const pretty = formatPrettyDate(iso);

  const onToggle = () => setFlipped((v) => !v);
  const onKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      onKeyDown={onKeyDown}
      aria-pressed={flipped}
      aria-label={`Details for ${pretty}`}
      style={{
        all: "unset",
        cursor: "pointer",
        ...outlineWrap,
        border: outlineColor,    // persistent outline
        boxShadow,               // depth both sides
      }}
    >
      <div style={flipWrap}>
        <div
          style={{
            ...flipInner,
            transform: flipped ? "rotateY(180deg)" : "none",
          }}
        >
          {/* Front: image + elevated date pill (both hidden on back) */}
          <div style={frontFace}>
            <div style={frontCenter}>
              <img
                src={iconSrc}
                alt={isDisc ? "discrepancy" : "ok"}
                style={iconImg}
              />
              <div style={datePillWrap}>
                <div style={{ position: "relative" }}>
                  <div style={dateHalo} />
                  <div style={datePill}>{pretty}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Back: solid info face only */}
          <div style={backFace}>
            <div style={backBody}>
              {rec ? (
                <>
                  <div
                    style={{
                      ...chip,
                      background: deltaBg,
                      color: "#131318",
                      fontSize: 14,
                    }}
                  >
                    Δ {rec.delta.toFixed(2)}
                  </div>
                  <div style={backRowBig}>Ticket: {rec.ticket_id}</div>
                  <div style={backRowBig}>
                    Ticket Vol: {rec.ticket_volume.toFixed(2)}
                  </div>
                  <div style={backRowBig}>
                    Drain Vol: {rec.drain_volume.toFixed(2)}
                  </div>
                  <div style={{ ...backRowBig, opacity: 0.85 }}>
                    Status: {rec.discrepancy ? "Discrepancy" : "OK"}
                  </div>
                </>
              ) : (
                <div style={{ ...backRowBig, opacity: 0.85 }}>No record</div>
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

/* Root layout */
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
  background:
    "radial-gradient(1000px 700px at -10% -10%, rgba(182,156,255,0.14), transparent 60%), " +
    "radial-gradient(1000px 700px at 110% -10%, rgba(127,231,196,0.10), transparent 60%), " +
    "#0b0b0b",
};

const title: React.CSSProperties = {
  margin: 0,
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

/**
 * 7 columns that always fit: each square uses a responsive width based on viewport.
 * Using aspectRatio keeps them perfectly square. No minWidth => no horizontal scroll.
 */
const daysGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 10,
  alignItems: "start",
};

/* Outline wrapper: persistent border, square sizing via responsive width */
const outlineWrap: React.CSSProperties = {
  position: "relative",
  width: "min(12.2vw, 156px)",   // slightly smaller container => fits 7 across
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

/* Make the icon visually big and shifted upward */
const iconImg: React.CSSProperties = {
  width: "94%",
  height: "94%",
  objectFit: "contain",
  transform: "translateY(-18px)", // ↑ moved up more
  filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.35))",
};

/* Date pill (cleaner look), shifted further upward */
const datePillWrap: React.CSSProperties = {
  position: "absolute",
  bottom: 34,                  // ↑ moved up more
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
  background:
    "radial-gradient(60% 120% at 50% 50%, rgba(168, 85, 247, 0.28), rgba(99,102,241,0.00))",
  pointerEvents: "none",
};

const chip: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: 0.2,
  boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
};

const backBody: React.CSSProperties = {
  padding: 10,
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  gap: 8,
  textAlign: "center",
};

const backRowBig: React.CSSProperties = {
  fontSize: 15.5,
  lineHeight: 1.28,
  opacity: 0.96,
  letterSpacing: 0.2,
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
