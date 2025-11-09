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

export default function WeekGraph({ cauldronName = "cauldron_001" }) {
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
    }));
  }, [data, cauldronName]);

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

  if (!data) return <p>Loading potion data...</p>;
  if (data.length === 0) return <p>No data available</p>;

  const { refAreaLeft, refAreaRight, left, right, top, bottom } = zoomState;

  return (
    <div
      style={{
        background: "#fceefaff",
        borderRadius: "20px",
        padding: "20px",
        margin: "40px auto",
        width: "520px",
        height: "450px",
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

        <ResponsiveContainer>
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
  );
}