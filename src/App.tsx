// src/App.tsx
// <WeekGraph cauldronName="cauldron_008" />
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from "./pages/Home";
import Tracking from "./pages/Tracking";
import Scheduling from "./pages/Scheduling";
import Forecast from "./pages/Forecast";
import WeekGraph from "./backend/weekGraph";
import mapUrl from "./assets/Map.svg";
import "./index.css";
import StatsPage from './Discrepency';
import { DataProvider } from './backend/FetchContext';

export default function App() {
  return (
    <DataProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tracking" element={
          <>
          <Tracking /> 
          
          </>
          } />
        <Route path="/scheduling" element={<Scheduling />} />
        <Route path="/forecast" element={<Forecast />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
    </BrowserRouter>
    </DataProvider>
  );
}
