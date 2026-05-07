import type { PatientState, Recommendation, RiskLevel, SpO2Class } from "../types";

export interface SocketFrame {
  patient_id: string;
  room_id: string;
  hr: number;
  spo2: number;
  rr: number;
  probability: number;
  prediction_window_sec: number;
  risk: RiskLevel;
  patient_state: PatientState;
  event: "AOP" | "PB" | "None";
  daily_event_count: number;
  last_event_ts?: number;
  spo2_classification: SpO2Class;
  recommendation: Recommendation;
  interventions: string[];
}

const WS_URL = (import.meta.env.VITE_NEOSENSE_WS_URL as string | undefined) ?? "ws://localhost:8000/ws/nicu";

let socket: WebSocket | null = null;
const listeners = new Set<(frame: SocketFrame) => void>();

const ensureConnection = (): void => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  socket = new WebSocket(WS_URL);
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as SocketFrame;
      if (!payload.patient_id || typeof payload.probability !== "number") return;
      listeners.forEach((listener) => listener(payload));
    } catch {
      // Ignore malformed frames to keep stream alive.
    }
  };
  socket.onclose = () => {
    window.setTimeout(() => ensureConnection(), 1200);
  };
  socket.onerror = () => {
    socket?.close();
  };
};

export const subscribeSocketFrames = (listener: (frame: SocketFrame) => void): (() => void) => {
  listeners.add(listener);
  ensureConnection();
  return () => {
    listeners.delete(listener);
  };
};
