import { Badge } from "./ui/Badge";
import logo from "../assets/neosense-logo.png";

export function TopNav() {
  return (
    <header className="topnav app-panel">
      <div className="topnav-brand">
        <img src={logo} alt="NeoSense AI" className="h-14 w-auto object-contain" />
        <h1 className="topnav-title">Nurse Command Center</h1>
        <p className="topnav-subtitle">Real-time neonatal monitoring with clinical AI guidance</p>
      </div>
      <div className="topnav-right">
        <select id="unit" className="topnav-select" defaultValue="NICU-1" aria-label="Unit selector">
          <option>NICU-1</option>
          <option>NICU-2</option>
        </select>
        <p className="topnav-meta">Network secure and connected</p>
        <Badge tone="accent">Nurse Workspace</Badge>
      </div>
    </header>
  );
}
