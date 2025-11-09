import { useState } from 'react';
import { useData } from './backend/FetchContext';
import './App.css'
import useCauldronRates from './backend/useCauldronRates';

function Discrepency() {
  const {data, ticketData} = useData();
  const averageRates = useCauldronRates(data);

  if (!avgRates) return <p>Calculating cauldron rates...</p>;

  return (
    <div>
      <h2>Average Flow Rate per Cauldron (units/min)</h2>
      <ul>
        {Object.entries(avgRates).map(([key, rate]) => (
          <li key={key}>
            {key}: {rate.toFixed(2)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Discrepency
