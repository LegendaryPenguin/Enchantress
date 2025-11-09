// getForecast.tsx

export default function getForecast(cauldron, avgRate, start_time, end_time){

  const errorRate = 0;
  const timeDifference = (end_time - start_time) / (1000 * 60);
  const standardDeviation = errorRate;
  
  const lowRange = (avgRate - errorRate) * timeDifference;

  const highRange = (avgRate + standardDeviation) * timeDifference;

  const estimatedValue = avgRate * timeDifference;

  return {lowRange: lowRange,
          estimatedValue: estimatedValue,
          highRange: highRange};

}

