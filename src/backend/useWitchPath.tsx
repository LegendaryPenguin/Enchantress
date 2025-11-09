import { useData } from "./FetchContext";
import useCauldronRates from "./useCauldronRates";
import { useEffect } from "react";

export default function useWitchPath(){

  const { data } = useData();

  const cauldronRates = useCauldronRates(data);

  console.log("Cauldron Rates: ", cauldronRates);
  
  useEffect(() => {
    if (!data || !cauldronRates) return;
    if (!Object.keys(cauldronRates).length) return;

    const scenario = {
      cauldrons: [
          { id: "cauldron_001", max_volume: 1000, rate: cauldronRates["cauldron_001"]}, // rate L/min 
          { id: "cauldron_002", max_volume: 800,  rate: cauldronRates["cauldron_002"]},
          { id: "cauldron_003", max_volume: 1200, rate: cauldronRates["cauldron_003"]},
          { id: "cauldron_004", max_volume: 750,  rate: cauldronRates["cauldron_004"]},
          { id: "cauldron_005", max_volume: 900,  rate: cauldronRates["cauldron_005"]},
          { id: "cauldron_006", max_volume: 650,  rate: cauldronRates["cauldron_006"]},
          { id: "cauldron_007", max_volume: 1100, rate: cauldronRates["cauldron_007"]},
          { id: "cauldron_008", max_volume: 700,  rate: cauldronRates["cauldron_008"]},
          { id: "cauldron_009", max_volume: 950,  rate: cauldronRates["cauldron_009"]},
          { id: "cauldron_010", max_volume: 850,  rate: cauldronRates["cauldron_010"]},
          { id: "cauldron_011", max_volume: 1050, rate: cauldronRates["cauldron_011"]},
          { id: "cauldron_012", max_volume: 600,  rate: cauldronRates["cauldron_012"]},
        ],

        couriersTemplate: [
          { courier_id: "courier_witch_01", max_carrying_capacity: 100 },
          { courier_id: "courier_witch_02", max_carrying_capacity: 100 },
          { courier_id: "courier_witch_03", max_carrying_capacity: 100 },
          { courier_id: "courier_witch_04", max_carrying_capacity: 100 },
          { courier_id: "courier_witch_05", max_carrying_capacity: 100 },
        ],
        network: {
          edges: [
            { from: "cauldron_001", to: "market_001", travel_time_minutes: 45 },
            { from: "cauldron_002", to: "market_001", travel_time_minutes: 40 },
            { from: "cauldron_003", to: "market_001", travel_time_minutes: 55 },
            { from: "cauldron_004", to: "market_001", travel_time_minutes: 32 },
            { from: "cauldron_005", to: "market_001", travel_time_minutes: 62 },
            { from: "cauldron_006", to: "market_001", travel_time_minutes: 28 },
            { from: "cauldron_007", to: "market_001", travel_time_minutes: 70 },
            { from: "cauldron_008", to: "market_001", travel_time_minutes: 22 },
            { from: "cauldron_009", to: "market_001", travel_time_minutes: 80 },
            { from: "cauldron_010", to: "market_001", travel_time_minutes: 20 },
            { from: "cauldron_011", to: "market_001", travel_time_minutes: 90 },
            { from: "cauldron_012", to: "market_001", travel_time_minutes: 15 },
            { from: "cauldron_001", to: "cauldron_002", travel_time_minutes: 22 },
            { from: "cauldron_002", to: "cauldron_004", travel_time_minutes: 25 },
            { from: "cauldron_003", to: "cauldron_005", travel_time_minutes: 30 },
            { from: "cauldron_004", to: "cauldron_006", travel_time_minutes: 18 },
            { from: "cauldron_005", to: "cauldron_007", travel_time_minutes: 28 },
            { from: "cauldron_006", to: "cauldron_008", travel_time_minutes: 15 },
            { from: "cauldron_007", to: "cauldron_009", travel_time_minutes: 32 },
            { from: "cauldron_008", to: "cauldron_010", travel_time_minutes: 12 },
            { from: "cauldron_009", to: "cauldron_011", travel_time_minutes: 20 },
            { from: "cauldron_010", to: "cauldron_012", travel_time_minutes: 10 },
          ]
     }

    }
    //fetch("/seed/background_data.json")
    
    if (!scenario.network?.edges || !scenario.cauldrons) {
      console.warn("Scenario is missing network or cauldrons data");
      return;
    }

    // === Build bidirectional graph ===
    const graph = {};
    for (const e of scenario.network.edges) {
      if (!graph[e.from]) graph[e.from] = [];
      if (!graph[e.to]) graph[e.to] = [];
      graph[e.from].push({ node: e.to, cost: e.travel_time_minutes });
      graph[e.to].push({ node: e.from, cost: e.travel_time_minutes }); // assume symmetric travel
    }

    // === Dijkstra shortest path ===
    function dijkstra(start) {
      const times = {};
      const visited = new Set();
      const pq = [[0, start]]; // [time, node]
      times[start] = 0;
      while (pq.length) {
        pq.sort((a, b) => a[0] - b[0]);
        const [time, node] = pq.shift();
        if (visited.has(node)) continue;
        visited.add(node);
        for (const edge of graph[node] || []) {
          const newTime = time + edge.cost;
          if (times[edge.node] == null || newTime < times[edge.node]) {
            times[edge.node] = newTime;
            pq.push([newTime, edge.node]);
          }
        }
      }
      return times;
    }

    // compute shortest travel times from each cauldron to market_001
    const travelToMarket = {};
    const toMarketTimes = dijkstra("market_001");
    for (const c of scenario.cauldrons) {
      travelToMarket[c.id] = toMarketTimes[c.id] ?? Infinity;
    }
    //console.log("Shortest one-way travel times to market:");
    //console.table(travelToMarket);

    // === Simulation ===
    
    function simulate(numCouriers, options = {}) { const { horizonMinutes = 24 * 60, timeStep = 1, initialVolumeFraction = 0.5 } = options;

      //const lastData = data && data.length > 0 ? data[data.length - 1] : null;
      const lastData = data && data.length > 0 
        ? data[Math.floor(Math.random() * data.length)] 
        : null;

      const cauldrons = scenario.cauldrons.map(c => {
        const lastLevel = lastData?.cauldron_levels?.[c.id];
        const initialVolume = lastLevel != null 
          ? lastLevel 
          : c.max_volume * initialVolumeFraction;
        
        //console.log("initial volume", initialVolume);
        return {
          ...c,
          volume: initialVolume,
          rate: cauldronRates[c.id],  
        };
      });

      const template = scenario.couriersTemplate[0];

      const couriers = Array.from({ length: numCouriers }, (_, i) => ({
        id: `courier_${i + 1}`,
        capacity: template.max_carrying_capacity,
        state: "idle",
        target: null,
        remaining: 0,
        log: [],
      }));

      function pickUrgentCauldron() {
        let best = null,
            bestUrgency = Infinity;
        for (const c of cauldrons) {
          const r = c.rate || 1e-9;
          const tOverflow = (c.max_volume - c.volume) / r;
          if (tOverflow < bestUrgency) {
            bestUrgency = tOverflow;
            best = c;
          }
        }
        return best;
      }

      for (let t = 0; t < horizonMinutes; t += timeStep) {
        // Update cauldrons
        for (const c of cauldrons) {
          c.volume += c.rate * timeStep;
          if (c.volume > c.max_volume) {
            console.log(`Overflow! ${c.id} at time ${t} min with volume ${c.volume}`);
            return { success: false, time: t, cauldron: c.id, volume: c.volume };
          }
        }

        // Update couriers in transit
        for (const courier of couriers) {
          if (courier.state === "idle") continue;
          courier.remaining -= timeStep;

          if (courier.remaining <= 0) {
            if (courier.state === "traveling_to") {
              const c = cauldrons.find(x => x.id === courier.target);
              if (!c) {
                console.log(`${courier.id} had invalid target`);
                courier.state = "idle";
                continue;
              }
              const amount = Math.min(c.volume, courier.capacity);
              c.volume -= amount;
              const oneWay = travelToMarket[c.id];
              courier.log.push({ time: t, action: `Collected ${amount.toFixed(2)} L from ${c.id}` });
              console.log(`${courier.id} collected ${amount.toFixed(2)} L from ${c.id} at t=${t}`);
              courier.state = "returning";
              courier.remaining = oneWay;
            } else if (courier.state === "returning") {
              courier.log.push({ time: t, action: `Delivered to market` });
              console.log(`${courier.id} delivered to market at t=${t}`);
              courier.state = "idle";
              courier.target = null;
              courier.remaining = 0;
            }
          }
        }

        // Assign idle couriers to urgent cauldrons
        for (const courier of couriers.filter(c => c.state === "idle")) {
          const target = pickUrgentCauldron();
          if (!target) {
            console.log(`${courier.id} found no urgent cauldron at t=${t}`);
            continue;
          }
          const oneWay = travelToMarket[target.id];
          if (oneWay === Infinity) {
            console.log(`${courier.id} cannot reach ${target.id} at t=${t}`);
            continue;
          }
          courier.state = "traveling_to";
          courier.target = target.id;
          courier.remaining = oneWay;
          console.log(`${courier.id} starts traveling to ${target.id} for ${oneWay} min at t=${t}`);
        }
      }

      return {
        success: true,
        finalVolumes: cauldrons.map(c => ({ id: c.id, volume: c.volume })),
        courierLogs: couriers.map(c => ({ id: c.id, log: c.log })),
      };
    }

    function findMinCouriers(maxCouriers = 10, options = {}) {
      for (let n = 1; n <= maxCouriers; n++) {
        const result = simulate(n, options);
        if (result.success) {
          return {
            minCouriers: n,
            ...result, 
          };
        }
      }
      return { minCouriers: null, courierLogs: [] };
    }

    // === RUN ===
    const result = findMinCouriers(8, { horizonMinutes: 24 * 60 });
    //console.log("Result:", result);
    result.courierLogs.forEach(c => {
    //console.log(`Path for ${c.id}:`);
    console.table(c.log);}); 

  });
}
