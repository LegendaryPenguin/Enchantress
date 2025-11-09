import { useState, useEffect } from "react";
import { from, pairwise, map, reduce } from 'rxjs';

export default function getCauldronRates(data){
  const [averageRates, setAverageRates] = useState(null);
  
  useEffect(() => {
    if (!data) return; 

    const subscription = from(data).pipe(
      pairwise(),
      map(([prev, curr]) => {
        const t1 = new Date(prev.timestamp);
        const t2 = new Date(curr.timestamp);
        const deltaMinutes = (t2 - t1) / 60000;

        const rates = {};
        for (const key of Object.keys(curr.cauldron_levels)) {
          const dLevel = curr.cauldron_levels[key] - prev.cauldron_levels[key];
          rates[key] = dLevel / deltaMinutes;
        }

        return rates; 
      }),
      reduce((acc, intervalRates) => {
        for (const key in intervalRates) {
          if (!acc[key]) acc[key] = { total: 0, count: 0 };
          acc[key].total += intervalRates[key];
          acc[key].count++;
        }
        return acc;
      }, {}),
      map(acc => {
        const avgRates = {};
        for (const key in acc) {
          avgRates[key] = acc[key].total / acc[key].count;
        }
        return avgRates;
      })
    ).subscribe(result => {
      setAverageRates(result);
    });

    return () => subscription.unsubscribe();
  }, [data]);

  return averageRates;

}

