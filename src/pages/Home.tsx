// src/pages/Home.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import mapUrl from "../assets/Map.svg";
import menuUrl from "../assets/frontpage/menu.svg";

export default function Home() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="screen"
      // full-bleed map background (no borders; may crop)
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: `url(${mapUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Menu button, top-left, anchored to the map */}
      <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
        <img src={menuUrl} alt="" />
      </button>

      {/* Scrim (click to close) */}
      <div className={`scrim ${open ? "show" : ""}`} onClick={() => setOpen(false)} />

      {/* Slide-out drawer (white, slightly opaque, ~1/5 width) */}
      <aside className={`drawer ${open ? "open" : ""}`} role="dialog" aria-modal="true">
        <div className="drawer-header">
          <span>Menu</span>
          <button className="close" onClick={() => setOpen(false)} aria-label="Close">×</button>
        </div>
        <nav className="nav">
          <Link to="/tracking" onClick={() => setOpen(false)}>Tracking</Link>
          <Link to="/scheduling" onClick={() => setOpen(false)}>Scheduling</Link>
        </nav>
      </aside>
    </div>
  );
}
