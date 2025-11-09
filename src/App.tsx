// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import Home from "./pages/Home";
import Tracking from "./pages/Tracking";
import Scheduling from "./pages/Scheduling";
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
