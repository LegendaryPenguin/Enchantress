import React from "react";
import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useData } from "./FetchContext"; // import your context hook


export default function WeekGraph({ cauldronName = "cauldron_001" }) {
  const { data } = useData();
  const [maxVolume, setMaxVolume] = useState(null);
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

  if (!data) return <p>Loading potion data...</p>;
  if (data.length === 0) return <p>No data available</p>;

  // Prepare data for Recharts
  const chartData = data.map((entry) => ({
    time: new Date(entry.timestamp).getTime(), // numeric time for X axis
    level: entry.cauldron_levels[cauldronName], // gets the potion level for the given cauldronName
  }));

  return (
    <div
        style={{
            background: "#fceefaff",
            borderRadius: "20px",     // rounded corners
            padding: "20px",          // space inside
            margin: "40px auto",      // space outside + centered
            width: "520px",           // slightly wider
            height: "450px",          // taller
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)", // soft shadow for depth
        }}
    >
    <div style={{ width: "100%", height: "100%" }}>
        <h3 style={{ textAlign: "center", marginBottom: "10px" }}>
        {cauldronName.replace("_", " ").toUpperCase()} Potion Levels (Weekly)
        </h3>

        <ResponsiveContainer>
        <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 10, bottom: 70 }}
        >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
            dataKey="time"
            type="number"
            domain={["auto", "auto"]}
            scale="time"
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
            formatter={(value) => [`${value.toFixed(2)} mL`, "Potion Level"]}
            />
            <Line
            type="monotone"
            dataKey="level"
            stroke="#8884d8"
            strokeWidth={2}
            dot={false}
            />
        </LineChart>
        </ResponsiveContainer>
    </div>
    </div>

  );
}
