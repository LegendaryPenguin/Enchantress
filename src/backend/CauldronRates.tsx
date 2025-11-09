import { useData } from "./FetchContext"
import { from, pairwise, map, reduce } from 'rxjs';

export default function CauldronRates(){

  const { data } = useData();
  
  useEffect(() => {

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
    });

  }, [data]);

}

