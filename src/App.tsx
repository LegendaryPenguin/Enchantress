// src/App.tsx
import mapUrl from "./assets/Map.svg";
import "./index.css";

export default function App() {
  return (
    <main
      style={{
        position: "fixed",
        inset: 0,                 // fill the viewport
        backgroundImage: `url(${mapUrl})`,
        backgroundSize: "cover",  // <-- no borders; may crop edges
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
