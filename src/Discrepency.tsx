import { useState } from 'react'
import './App.css'
import { from, pairwise, map, reduce } from 'rxjs';

function Discrepency() {
  [average, setAverage] = useState(null);

  const data = [
    {
      timestamp: "2025-10-30T00:00:00+00:00",
      cauldron_levels: { cauldron_001: 226.98, cauldron_002: 240.22 }
    },
    {
      timestamp: "2025-10-30T00:01:00+00:00",
      cauldron_levels: { cauldron_001: 227.03, cauldron_002: 240.29 }
    },
    {
      timestamp: "2025-10-30T00:02:00+00:00",
      cauldron_levels: { cauldron_001: 227.12, cauldron_002: 240.46 }
    }
  ];

  from(data).pipe(
    pairwise(),
    map(([prev, curr]) => {
      const t1 = new Date(prev.timestamp);
      const t2 = new Date(curr.timestamp);
      const deltaMinutes = (t2 - t1) / 60000;

      // Compute rate of change for *each cauldron*
      const rates = {};
      for (const key of Object.keys(curr.cauldron_levels)) {
        const dLevel = curr.cauldron_levels[key] - prev.cauldron_levels[key];
        rates[key] = dLevel / deltaMinutes;
      }

      return rates; // Object of cauldron rates for this interval
    }),
    reduce((acc, intervalRates) => {
      // Aggregate totals for each cauldron
      for (const key in intervalRates) {
        if (!acc[key]) acc[key] = { total: 0, count: 0 };
        acc[key].total += intervalRates[key];
        acc[key].count++;
      }
      return acc;
    }, {}),
    map(acc => {
      // Compute average rate for each cauldron
      const avgRates = {};
      for (const key in acc) {
        avgRates[key] = acc[key].total / acc[key].count;
      }
      return avgRates;
    })
  ).subscribe(avgRates => {
    console.log("Average flow rate per cauldron (units/min):");
    console.table(avgRates);
    setAverage(avgRates);
  });

  return (
    <>
      <div>
       
      </div>
    </>
  )
}

export default Discrepency
