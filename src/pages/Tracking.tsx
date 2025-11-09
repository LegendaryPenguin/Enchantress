// src/pages/Tracking.tsx
import React, { useEffect, useMemo, useState } from "react";
import explodeSvg from "../assets/second/explode.svg";
import notexplodeSvg from "../assets/second/not_explode.svg";
import { useData } from "../backend/FetchContext";
import { getDiscrepancyCheck } from "../backend/getDiscrepancyCheck";

/* ===== Types ===== */
type DayRecord = {
  date: string;                 // "YYYY-MM-DD" (local day)
  time?: string;                // "HH:MM" (local) for OK days or when available
  ticket_id?: string;
  cauldron_id: string;
  ticket_volume?: number;
  drain_volume?: number;
  delta: number;                // use volume_diff / lost_amount when ticket/drain missing
  discrepancy: boolean;
  error_type?: string;
};

type CauldronDays = {
  id: string;
  name?: string;
  days: DayRecord[];
};

type Payload = { cauldrons: CauldronDays[] };

/* ===== Helpers ===== */
function formatPrettyDate(isoYYYYMMDD: string) {
  const [y, m, d] = isoYYYYMMDD.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Convert any Date/ISO/timestamp into local YYYY-MM-DD */
function toLocalISODate(x: unknown): string {
  if (!x) return "";
  const dt = new Date(x as any);
  if (isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = pad2(dt.getMonth() + 1);
  const d = pad2(dt.getDate());
  return `${y}-${m}-${d}`;
}

/** Return "HH:MM" local from a timestamp-like value */
function toLocalHHMM(x: unknown): string | undefined {
  if (!x) return undefined;
  const dt = new Date(x as any);
  if (isNaN(dt.getTime())) return undefined;
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Enumerate all local dates (inclusive) from startYYYYMMDD to endYYYYMMDD */
function enumerateLocalDates(startYYYYMMDD: string, endYYYYMMDD: string): string[] {
  const out: string[] = [];
  const start = new Date(`${startYYYYMMDD}T12:00:00`); // midday avoids DST edges
  const end = new Date(`${endYYYYMMDD}T12:00:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(toLocalISODate(d));
  }
  return out;
}

/** From telemetry `data` find a representative time string on a given local day for a cauldron */
function findAnyTimeForDay(
  data: any[],
  cauldronId: string,
  isoDay: string
): string | undefined {
  for (const p of data ?? []) {
    const hasKey =
      p?.cauldron_levels &&
      Object.prototype.hasOwnProperty.call(p.cauldron_levels, cauldronId);
    if (!hasKey) continue;
    const day = toLocalISODate(p.timestamp);
    if (day === isoDay) {
      return toLocalHHMM(p.timestamp);
    }
  }
  return undefined;
}

/* ===== Page ===== */
export default function Tracking() {
  const [dataPayload, setDataPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const { data, ticketData } = useData();

  useEffect(() => {
    console.log("[Tracking] useData raw telemetry:", data);
    console.log("[Tracking] useData ticketData:", ticketData);

    if (!Array.isArray(data) || data.length === 0 || !ticketData) return;

    try {
      // Discover cauldrons by inspecting first telemetry row
      const firstLevels = data[0]?.cauldron_levels ?? {};
      const cauldronKeys = Object.keys(firstLevels);
      console.log("[Tracking] discovered cauldrons:", cauldronKeys);

      // Gather discrepancies once per cauldron and also track global earliest/latest day
      const discById = new Map<string, any[]>();
      let minDay: string | null = null;
      let maxDay: string | null = null;

      // consider telemetry days too so non-discrepancy days still show
      for (const p of data) {
        const day = toLocalISODate(p?.timestamp);
        if (!day) continue;
        if (!minDay || day < minDay) minDay = day;
        if (!maxDay || day > maxDay) maxDay = day;
      }

      for (const id of cauldronKeys) {
        const discs: any[] = getDiscrepancyCheck(data, ticketData, id) ?? [];
        discById.set(id, discs);
        for (const d of discs) {
          const day = toLocalISODate(d?.timestamp ?? d?.date ?? d?.iso ?? d?.iso_date);
          if (!day) continue;
          if (!minDay || day < minDay) minDay = day;
          if (!maxDay || day > maxDay) maxDay = day;
        }
        console.log(`[Tracking] raw discrepancies for ${id}:`, discs);
      }

      // Fall back to 7 days from today if we somehow didn't find any date
      const dayList =
        minDay && maxDay ? enumerateLocalDates(minDay, maxDay) : (() => {
          const out: string[] = [];
          const now = new Date();
          for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setHours(12, 0, 0, 0);
            d.setDate(d.getDate() - i);
            out.push(toLocalISODate(d));
          }
          return out;
        })();

      console.log("[Tracking] global date span (oldest→newest):", dayList);

      const cauldrons: CauldronDays[] = cauldronKeys.map((id) => {
        const discrepancies = discById.get(id) ?? [];

        // Normalize discrepancies to a per-day map
        const byDay = new Map<string, any[]>();
        for (const disc of discrepancies) {
          const day = toLocalISODate(disc?.timestamp ?? disc?.date ?? disc?.iso ?? disc?.iso_date);
          if (!day) continue;
          if (!byDay.has(day)) byDay.set(day, []);
          byDay.get(day)!.push(disc);
        }
        console.log(`[Tracking] byDay map for ${id}:`, byDay);

        // Build records for every date in the full span
        const days: DayRecord[] = dayList.map((isoDay) => {
          const discs = byDay.get(isoDay) ?? [];
          if (discs.length > 0) {
            // pick discrepancy with largest absolute delta
            const chosen = discs.reduce((a, b) => {
              const da = Math.abs(
                Number(a?.volume_diff ?? a?.lost_amount ?? a?.difference ?? a?.delta ?? 0)
              );
              const db = Math.abs(
                Number(b?.volume_diff ?? b?.lost_amount ?? b?.difference ?? b?.delta ?? 0)
              );
              return db > da ? b : a;
            }, discs[0]);

            const delta = Number(
              chosen?.volume_diff ?? chosen?.lost_amount ?? chosen?.difference ?? chosen?.delta ?? 0
            );
            const ticketVol = isFiniteNum(chosen?.amount_collected ?? chosen?.ticket_volume)
              ? Number(chosen?.amount_collected ?? chosen?.ticket_volume)
              : undefined;
            const drainVol = isFiniteNum(chosen?.actual_drained ?? chosen?.drain_volume)
              ? Number(chosen?.actual_drained ?? chosen?.drain_volume)
              : undefined;
            const ticket_id =
              chosen?.ticket_id ?? chosen?.ticket ?? chosen?.ticketId ?? undefined;
            const discrepancy =
              typeof chosen?.isDiscrepancy === "boolean"
                ? chosen?.isDiscrepancy
                : Math.abs(delta) > 0.5;

            const timeStr = toLocalHHMM(chosen?.timestamp);

            const rec: DayRecord = {
              date: isoDay,
              time: timeStr,
              ticket_id,
              cauldron_id: id,
              ticket_volume: ticketVol,
              drain_volume: drainVol,
              delta: Number.isFinite(delta) ? delta : 0,
              discrepancy,
              error_type: chosen?.error_type,
            };
            return rec;
          } else {
            // OK day → show a representative time if any
            const timeStr = findAnyTimeForDay(data, id, isoDay);
            return {
              date: isoDay,
              time: timeStr,
              cauldron_id: id,
              delta: 0,
              discrepancy: false,
            };
          }
        });

        console.log(`[Tracking] span DayRecords for ${id}:`, days);
        return { id, name: id, days };
      });

      const payload: Payload = { cauldrons };
      console.log("[Tracking] FINAL payload sent to UI:", payload);

      setDataPayload(payload);
      setErr(null);
    } catch (e: any) {
      console.error("[Tracking] build payload error:", e);
      setErr(e?.message ?? "failed to build discrepancy payload");
    } finally {
      setLoading(false);
    }
  }, [data, ticketData]);

  // Safety valve: stop spinner if context never arrives
  useEffect(() => {
    const t = setTimeout(() => {
      if (!dataPayload && (!data || data.length === 0)) setLoading(false);
    }, 3000);
    return () => clearTimeout(t);
  }, [data, dataPayload]);

  const cauldrons = useMemo(() => {
    if (!dataPayload) return [];
    return [...dataPayload.cauldrons].sort((a, b) => a.id.localeCompare(b.id));
  }, [dataPayload]);

  if (loading) return <Screen>Loading…</Screen>;
  if (err) return <Screen>Error: {err}</Screen>;
  if (!dataPayload || cauldrons.length === 0) return <Screen>No data</Screen>;

  return (
    <div style={root}>
      {/* Witchy scrollbar styles (scoped via class) */}
      <style>{`
        .witchy-scroll { scrollbar-width: thin; scrollbar-color: #a78bfa1f transparent; }
        .witchy-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
        .witchy-scroll::-webkit-scrollbar-track {
          background: linear-gradient(180deg, rgba(167,139,250,0.10), rgba(59,7,100,0.14));
          border-radius: 999px; box-shadow: inset 0 0 6px rgba(0,0,0,0.35);
        }
        .witchy-scroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: linear-gradient(180deg, #c084fc, #9333ea);
          border: 2px solid rgba(16,16,20,0.6);
          box-shadow: 0 0 10px rgba(168,85,247,0.55), inset 0 0 6px rgba(255,255,255,0.18);
          transition: background 160ms ease, box-shadow 160ms ease;
        }
        .witchy-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #d8b4fe, #a855f7);
          box-shadow: 0 0 14px rgba(192,132,252,0.75), inset 0 0 8px rgba(255,255,255,0.22);
        }
        .witchy-scroll::-webkit-scrollbar-corner { background: transparent; }
      `}</style>

      <h1 style={title}>Daily Discrepancy Tracker</h1>

      <div style={rows} className="witchy-scroll">
        {cauldrons.map((c) => (
          <div key={c.id} style={card}>
            <div style={cardHead}>
              <div style={{ fontWeight: 700, letterSpacing: 0.2 }}>
                {c.name ?? c.id}
              </div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>{c.id}</div>
            </div>

            {/* Full date span (earliest→latest), horizontally scrollable per cauldron */}
            <div style={daysGrid} className="witchy-scroll">
              {c.days.map((rec) => (
                <DayCard key={`${c.id}-${rec.date}`} iso={rec.date} rec={rec} />
              ))}
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
  const [hovered, setHovered] = useState(false);
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
      }}
    >
      <div style={flipWrap}>
        <div
          style={{
            ...flipInner,
            transform: flipped ? "rotateY(180deg)" : "none",
          }}
        >
          {/* Front */}
          <div style={frontFace}>
            <div style={frontCenter}>
              <img src={iconSrc} alt={isDisc ? "discrepancy" : "ok"} style={iconImg} />
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
              {rec ? (
                <>
                  {!rec.discrepancy ? (
                    <>
                      {rec.time ? (
                        <div style={{ ...backRowBig, opacity: 0.95 }}>
                          Time: {rec.time}
                        </div>
                      ) : (
                        <div style={{ ...backRowBig, opacity: 0.85 }}>
                          No discrepancy
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ ...chip, background: deltaBg, color: "#131318", fontSize: 14 }}>
                        Δ {rec.delta.toFixed(2)}
                      </div>
                      {rec.error_type && (
                        <div style={{ ...backRowBig, opacity: 0.92 }}>
                          Error: {rec.error_type}
                        </div>
                      )}
                      {rec.time && <div style={backRowBig}>TS: {rec.time}</div>}
                      {rec.ticket_id && <div style={backRowBig}>Ticket: {rec.ticket_id}</div>}
                      {isFiniteNum(rec.ticket_volume) && (
                        <div style={backRowBig}>Ticket Vol: {rec.ticket_volume!.toFixed(2)}</div>
                      )}
                      {isFiniteNum(rec.drain_volume) && (
                        <div style={backRowBig}>VolDiff: {rec.delta.toFixed(2)}</div>
                      )}
                    </>
                  )}
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

/** Horizontal scroller per cauldron row */
const daysGrid: React.CSSProperties = {
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "minmax(140px, 156px)",
  gap: 10,
  alignItems: "start",
  overflowX: "auto",
  padding: "6px 6px 8px 8px", // ensure left-most card isn't clipped
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
