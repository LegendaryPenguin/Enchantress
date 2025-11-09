// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import mapUrl from "./assets/Map.svg";
import "./index.css";
import StatsPage from './Discrepency';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tracking" element={<Tracking />} />
        <Route path="/scheduling" element={<Scheduling />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
