// getForecast.tsx

import { useData } from './FetchContext';
import useCauldronRates from './useCauldronRates';

export default function useForecast(cauldron, start_time, end_time){
  const { data } = useData();
  const averageRates = useCauldronRates(data);
  const cauldronRate = averagesRates[cauldron];

  const errorRate = 0;
  let timeDifference = end_time - start_time;
  let standardDeviation = errorRate;
  
  lowRange = (cauldronRate - errorRate) * timeDifference;

  highRange = (cauldronRate + standardDeviation) * timeDifference;

  estimatedValue = cauldronRate * timeDifference;

  return {lowRange: lowRange,
          estimatedValue: estimatedValue,
          highRange: highRange};

}

