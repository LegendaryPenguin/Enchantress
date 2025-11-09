// src/pages/Tracking.tsx
import { useDiscrepancyCheck } from '../backend/useDiscrepancyCheck';

export default function Tracking() {
  const cauldron_tickets = useDiscrepancyCheck("cauldron_008");
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

      Tracking (placeholder)
    </div>
  );
}
