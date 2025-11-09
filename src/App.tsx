// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import mapUrl from "./assets/Map.svg";
import "./index.css";
import StatsPage from './Discrepency';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={
            <main
              style={{
                position: "fixed",
                inset: 0,
                backgroundImage: `url(${mapUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
          } 
        />
        <Route path="/stats" element={<StatsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
