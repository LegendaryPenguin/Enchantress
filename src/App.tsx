// src/App.tsx
// <WeekGraph cauldronName="cauldron_008" />
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from "./pages/Home";
import Tracking from "./pages/Tracking";
import Scheduling from "./pages/Scheduling";
import WeekGraph from "./backend/weekGraph";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tracking" element={
          <>
          <Tracking /> 
          
          </>
          } />
        <Route path="/scheduling" element={<Scheduling />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
    </BrowserRouter>
  );
}