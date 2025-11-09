// src/pages/Scheduling.tsx

import { useData } from "../backend/FetchContext"
import getForecast from "../backend/useForecast"
import useCauldronRates from "../backend/useCauldronRates"
import { useState, useEffect } from "react"

export default function Scheduling() {
  const [cauldronData, setCauldronData] = useState({});
  const { data, ticketData } = useData();

  const averageRates = useCauldronRates(data); 

  useEffect(() => {
    const cauldronKeys = Object.keys(data[0].cauldron_levels);
    console.log(cauldronKeys);

    const newData: Record<string, any[]> = {};

    cauldronKeys.forEach(cauldron => {
      let cauldronRate = getForecast(cauldron)
      newData[cauldron] = discrepancies;
    });
    
    console.log("discrepancies: ", newData);
    console.log("cauldron general data: ", data);
    setCauldronData(newData);
    
  }, [data, ticketData]);

  return (
    <div
      style={{
        height: "100vh",
        background: "black",
        color: "white",
        display: "grid",
        placeItems: "center",
        fontSize: 24,
      }}
    >
      Scheduling (placeholder)
    </div>
  );
}
