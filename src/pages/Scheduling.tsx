// src/pages/Scheduling.tsx

import { useData } from "../backend/FetchContext"
import getForecast from "../backend/getForecast"
import useCauldronRates from "../backend/useCauldronRates"
import { useState, useEffect } from "react"

export default function Scheduling() {
  const [forecastData, setForecastData] = useState({});
  const { data, ticketData } = useData();

  const averageRates = useCauldronRates(data); 

  useEffect(() => {

    if (!data || data.length === 0 || !averageRates) return;

    const cauldronKeys = Object.keys(data[0].cauldron_levels);
    console.log(cauldronKeys);

    const newData: Record<string, any[]> = {};

    cauldronKeys.forEach(cauldron => {
      const start_time = new Date("2025-11-07T00:00:00+00:00").getTime();
      const end_time = start_time + 24 * 60 * 60 * 1000;

      newData[cauldron] = getForecast(cauldron, averageRates[cauldron], start_time, end_time);

    });
    
    console.log("forecast data: ");
    setForecastData(newData);
  }, [data, averageRates]);

  return (
        <div
          style={{
            minHeight: "100vh",
            background: "#111",
            color: "white",
            padding: "2rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.5rem",
            fontFamily: "Arial, sans-serif",
          }}
        >
          {Object.entries(forecastData).map(([cauldron, forecast]) => (
            <div
              key={cauldron}
              style={{
                background: "#222",
                padding: "1rem",
                borderRadius: "8px",
                boxShadow: "0 0 10px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.2rem" }}>{cauldron}</h3>
              <div>
                <strong>Low:</strong> {forecast.lowRange.toFixed(2)} L
              </div>
              <div>
                <strong>Est.:</strong> {forecast.estimatedValue.toFixed(2)} L
              </div>
              <div>
                <strong>High:</strong> {forecast.highRange.toFixed(2)} L
              </div>
            </div>
          ))}
        </div>
      );
}
