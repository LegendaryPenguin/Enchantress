import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  cauldron: { id: string; name?: string; max_volume?: number } | null;
};

// ---- Required window (hard-coded) ----
const START_EPOCH = 1762444800;
const END_EPOCH   = 1762444950;

type Point = { t: number; v: number };

export default function CauldronModal({ open, onClose, cauldron }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [series, setSeries]   = useState<Point[]>([]);

  useEffect(() => {
    if (!open || !cauldron) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setSeries([]);

      try {
        const data = await fetchWindow(START_EPOCH, END_EPOCH);
        const pts  = extractForCauldron(data, cauldron.id);
        if (!cancelled) setSeries(pts);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, cauldron]);

  const startVal = useMemo(
    () => (series.length ? series[0].v : undefined),
    [series]
  );
  const endVal = useMemo(
    () => (series.length ? series[series.length - 1].v : undefined),
    [series]
  );
  const maxV = cauldron?.max_volume ?? 0;

  const pct = (val?: number) =>
    !maxV || val === undefined ? 0 : Math.max(0, Math.min(100, (val / maxV) * 100));

  if (!open || !cauldron) return null;

  return (
    <div className="modal-scrim" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div className="modal-title">
            <div className="modal-name">{cauldron.name ?? cauldron.id}</div>
            <div className="modal-sub">
              ID: {cauldron.id} · Max volume: {maxV || "—"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <section className="modal-controls">
          <div>
            <div className="label-fixed">start_date (epoch):</div>
            <code className="code-fixed">{START_EPOCH}</code>
          </div>
          <div>
            <div className="label-fixed">end_date (epoch):</div>
            <code className="code-fixed">{END_EPOCH}</code>
          </div>
          <small>
            Calls <code>/api/Data?start_date={START_EPOCH}&amp;end_date={END_EPOCH}</code>
          </small>
        </section>

        <section className="meters">
          <div className="meter-row">
            <div className="meter-label">Start</div>
            <div className="meter">
              <div className="meter-fill meter-purple" style={{ width: `${pct(startVal)}%` }} />
              <div className="meter-text">
                {startVal !== undefined ? startVal.toFixed(2) : "—"} / {maxV || "—"}
              </div>
            </div>
          </div>

          <div className="meter-row">
            <div className="meter-label">End</div>
            <div className="meter">
              <div className="meter-fill meter-purple" style={{ width: `${pct(endVal)}%` }} />
              <div className="meter-text">
                {endVal !== undefined ? endVal.toFixed(2) : "—"} / {maxV || "—"}
              </div>
            </div>
          </div>
        </section>

        {loading && <div className="note">Loading…</div>}
        {error   && <div className="note error">Error: {error}</div>}
        {!loading && !error && series.length === 0 && (
          <div className="note">No points returned for this window.</div>
        )}
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */

async function fetchWindow(start: number, end: number): Promise<any> {
  // Prefer JSON; if server returns HTML (redirect/error), retry with trailing slash
  const tryFetch = async (path: string) => {
    const res  = await fetch(path, { headers: { Accept: "application/json" } });
    const text = await res.text();
    const ct   = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return JSON.parse(text);
    throw new Error(`Non-JSON (${res.status}). First 120 chars: ${text.slice(0, 120)}`);
  };

  try {
    return await tryFetch(`/api/Data?start_date=${start}&end_date=${end}`);
  } catch (e1) {
    // Some servers require the trailing slash on /Data/
    return await tryFetch(`/api/Data/?start_date=${start}&end_date=${end}`);
  }
}

function extractForCauldron(raw: any, id: string): Point[] {
  if (!raw) return [];

  // A) array of records
  if (Array.isArray(raw)) {
    const pts = raw
      .filter((r) => String(r.cauldron_id ?? r.cauldronId ?? r.id ?? r.cauldron) === id)
      .map(toPoint)
      .filter(Boolean) as Point[];
    return sortUnique(pts);
  }

  // B) object keyed by cauldron id
  if (raw[id] && Array.isArray(raw[id])) {
    const pts = (raw[id] as any[]).map(toPoint).filter(Boolean) as Point[];
    return sortUnique(pts);
  }

  // C) nested under "data"
  if (raw.data) return extractForCauldron(raw.data, id);

  return [];
}

function toPoint(r: any): Point | null {
  const t = r.timestamp ?? r.ts ?? r.time ?? r.t;
  const v = r.volume ?? r.level ?? r.value ?? r.v;
  if (t == null || v == null) return null;
  const tt = typeof t === "string" ? Number(t) : t;
  const vv = typeof v === "string" ? Number(v) : v;
  if (!isFinite(tt) || !isFinite(vv)) return null;
  return { t: tt, v: vv };
}

function sortUnique(arr: Point[]): Point[] {
  const a = [...arr].sort((A, B) => A.t - B.t);
  return a.filter((p, i) => (i === 0 ? true : p.t !== a[i - 1].t));
}
