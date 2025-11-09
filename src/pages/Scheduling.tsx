// src/pages/Scheduling.tsx
import WeekGraph from "../backend/weekGraph";

export default function Tracking() {
  return (
    <div>
      <h1>Tracking Page</h1>
      <WeekGraph cauldronName="cauldron_005" />
    </div>
  );
}