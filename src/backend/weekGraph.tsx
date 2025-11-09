import React from "react";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { useData } from "./FetchContext";

type ZoomState = {
  left: string | number;
  right: string | number;
  refAreaLeft: string | number | undefined;
  refAreaRight: string | number | undefined;
  top: string | number;
  bottom: string | number;
};

const initialZoomState: ZoomState = {
  left: 'dataMin',
  right: 'dataMax',
  refAreaLeft: undefined,
  refAreaRight: undefined,
  top: 'dataMax+10',
  bottom: 'dataMin-10',
};

export default function WeekGraph({ 
  cauldronName = "cauldron_001",
  averageRate = null,
  startVolume = null,
  endVolume = null,
  startDate = null,
  endDate = null
}) {
  const { data } = useData();
  const [maxVolume, setMaxVolume] = useState(null);
  const [zoomState, setZoomState] = useState<ZoomState>(initialZoomState);

  // Fetch background data to get max_volume
  useEffect(() => {
    async function fetchMaxVolume() {
      try {
        const res = await fetch("/seed/background_data.json");
        const json = await res.json();
        const cauldron = json.cauldrons.find(c => c.id === cauldronName);
        if (cauldron) {
          setMaxVolume(cauldron.max_volume);
        }
      } catch (err) {
        console.error("Failed to fetch background data:", err);
      }
    }
    fetchMaxVolume();
  }, [cauldronName]);

  // Memoize chartData to prevent recalculation on every render
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((entry) => ({
      time: new Date(entry.timestamp).getTime(),
      level: entry.cauldron_levels[cauldronName],
      timestamp: entry.timestamp,
    }));
  }, [data, cauldronName]);

  // Calculate stats for the current zoom window
  const currentStats = useMemo(() => {
    if (chartData.length === 0) {
      return {
        startVolume,
        endVolume,
        averageRate,
        startDate,
        endDate,
      };
    }

    const { left, right } = zoomState;
    
    // If we're at the initial zoom state, use the passed props
    if (left === 'dataMin' && right === 'dataMax') {
      return {
        startVolume,
        endVolume,
        averageRate,
        startDate,
        endDate,
      };
    }

    // Filter data to the zoomed window
    const filteredData = chartData.filter(d => {
      const time = d.time;
      const leftVal = left === 'dataMin' ? chartData[0].time : Number(left);
      const rightVal = right === 'dataMax' ? chartData[chartData.length - 1].time : Number(right);
      return time >= leftVal && time <= rightVal;
    });

    if (filteredData.length === 0) {
      return {
        startVolume,
        endVolume,
        averageRate,
        startDate,
        endDate,
      };
    }

    // Calculate new stats for zoomed window
    const newStartVolume = filteredData[0].level;
    const newEndVolume = filteredData[filteredData.length - 1].level;
    const newStartDate = filteredData[0].timestamp;
    const newEndDate = filteredData[filteredData.length - 1].timestamp;

    // Calculate average fill rate for zoomed window
    let totalRate = 0;
    let count = 0;
    for (let i = 1; i < filteredData.length; i++) {
      const prev = filteredData[i - 1];
      const curr = filteredData[i];
      const deltaTime = (curr.time - prev.time) / 60000; // minutes
      const deltaLevel = curr.level - prev.level;
      if (deltaTime > 0) {
        totalRate += deltaLevel / deltaTime;
        count++;
      }
    }
    const newAverageRate = count > 0 ? totalRate / count : null;

    return {
      startVolume: newStartVolume,
      endVolume: newEndVolume,
      averageRate: newAverageRate,
      startDate: newStartDate,
      endDate: newEndDate,
    };
  }, [chartData, zoomState, startVolume, endVolume, averageRate, startDate, endDate]);

  const getAxisYDomain = useCallback(
    (from: number | undefined, to: number | undefined, offset: number): (number | string)[] => {
      if (from != null && to != null && chartData.length > 0) {
        const refData = chartData.filter(d => d.time >= from && d.time <= to);
        if (refData.length === 0) return [initialZoomState.bottom, initialZoomState.top];
        
        let bottom = refData[0].level;
        let top = refData[0].level;
        
        refData.forEach(d => {
          if (d.level > top) top = d.level;
          if (d.level < bottom) bottom = d.level;
        });

        return [Math.floor(bottom) - offset, Math.ceil(top) + offset];
      }
      return [0, maxVolume || 'dataMax+10'];
    },
    [chartData, maxVolume]
  );

  const zoom = useCallback(() => {
    setZoomState((prev: ZoomState): ZoomState => {
      let { refAreaLeft, refAreaRight } = prev;

      if (refAreaLeft === refAreaRight || refAreaRight === '' || !refAreaLeft || !refAreaRight) {
        return {
          ...prev,
          refAreaLeft: undefined,
          refAreaRight: undefined,
        };
      }

      if (refAreaLeft > refAreaRight) {
        [refAreaLeft, refAreaRight] = [refAreaRight, refAreaLeft];
      }

      const [bottom, top] = getAxisYDomain(
        Number(refAreaLeft),
        Number(refAreaRight),
        10
      );

      return {
        ...prev,
        refAreaLeft: undefined,
        refAreaRight: undefined,
        left: refAreaLeft,
        right: refAreaRight,
        bottom,
        top,
      };
    });
  }, [getAxisYDomain]);

  const zoomOut = useCallback(() => {
    setZoomState(initialZoomState);
  }, []);

  const onMouseDown = useCallback((e: any) => {
    if (e && e.activeLabel) {
      setZoomState((prev: ZoomState) => ({ ...prev, refAreaLeft: e.activeLabel }));
    }
  }, []);

  const onMouseMove = useCallback((e: any) => {
    if (e && e.activeLabel) {
      setZoomState(prev => {
        if (prev.refAreaLeft) {
          return { ...prev, refAreaRight: e.activeLabel };
        }
        return prev;
      });
    }
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (!data) return <p>Loading potion data...</p>;
  if (data.length === 0) return <p>No data available</p>;

  const { refAreaLeft, refAreaRight, left, right, top, bottom } = zoomState;

  return (
    <div>
      {/* Stats Bar */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "12px",
        marginBottom: "20px",
        padding: "16px",
        background: "rgba(139,92,246,.08)",
        borderRadius: "12px",
        border: "1px solid rgba(139,92,246,.25)"
      }}>
        <div style={{ 
          padding: "10px",
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid rgba(139,92,246,.15)"
        }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#666", marginBottom: "4px" }}>
            RANGE
          </div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0b1020" }}>
            {formatDate(currentStats.startDate)}
          </div>
          <div style={{ fontSize: "11px", color: "#888", margin: "2px 0" }}>to</div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#0b1020" }}>
            {formatDate(currentStats.endDate)}
          </div>
        </div>

        <div style={{ 
          padding: "10px",
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid rgba(139,92,246,.15)"
        }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#666", marginBottom: "4px" }}>
            AVG FILL RATE
          </div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "#8B5CF6" }}>
            {currentStats.averageRate !== null ? `${currentStats.averageRate.toFixed(2)} mL/min` : "—"}
          </div>
        </div>

        <div style={{ 
          padding: "10px",
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid rgba(139,92,246,.15)"
        }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#666", marginBottom: "4px" }}>
            START VOLUME
          </div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "#0b1020" }}>
            {currentStats.startVolume !== null ? `${currentStats.startVolume.toFixed(2)} mL` : "—"}
          </div>
        </div>

        <div style={{ 
          padding: "10px",
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid rgba(139,92,246,.15)"
        }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#666", marginBottom: "4px" }}>
            END VOLUME
          </div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "#0b1020" }}>
            {currentStats.endVolume !== null ? `${currentStats.endVolume.toFixed(2)} mL` : "—"}
          </div>
        </div>
      </div>

      {/* Graph */}
      <div
        style={{
          background: "#fceefaff",
          borderRadius: "20px",
          padding: "20px",
          boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ width: "100%", height: "100%", userSelect: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h3 style={{ margin: 0 }}>
              {cauldronName.replace("_", " ").toUpperCase()} Potion Levels (Weekly)
            </h3>
            <button
              onClick={zoomOut}
              style={{
                padding: "5px 15px",
                background: "#8884d8",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              Zoom Out
            </button>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 10, bottom: 70 }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={zoom}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                type="number"
                domain={[left, right]}
                scale="time"
                allowDataOverflow
                tickFormatter={(unixTime) =>
                  new Date(unixTime).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
                label={{ value: "Date", position: "insideBottom", offset: -10 }}
              />
              <YAxis
                domain={[0, maxVolume || "auto"]}
                allowDataOverflow
                tickFormatter={(value) => Math.round(value).toString()}
                label={{
                  value: "Potion Level",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: "middle" },
                }}
              />
              <Tooltip
                labelFormatter={(unixTime) =>
                  new Date(unixTime).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                }
                formatter={(value) => [`${Number(value).toFixed(2)} mL`, "Potion Level"]}
              />
              <Line
                type="monotone"
                dataKey="level"
                stroke="#8884d8"
                strokeWidth={2}
                dot={false}
                animationDuration={0}
                isAnimationActive={false}
              />
              {refAreaLeft && refAreaRight ? (
                <ReferenceArea
                  x1={refAreaLeft}
                  x2={refAreaRight}
                  strokeOpacity={0.3}
                  fill="#8884d8"
                  fillOpacity={0.3}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}