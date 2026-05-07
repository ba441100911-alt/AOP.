import { create } from "zustand";
import { seedPatient, tickPatient } from "../lib/simulator";
import { fetchBackendStreamFrame, mapBackendPayloadToSample } from "../lib/streamAdapter";
import { subscribeSocketFrames } from "../lib/socketStream";
import type { SocketFrame } from "../lib/socketStream";
import type { NurseAssignment, Patient, Role } from "../types";

interface MonitorState {
  role: Role;
  rooms: Record<string, string[]>;
  patients: Patient[];
  dailyEventCounts: Record<string, number>;
  nurseAssignment: NurseAssignment;
  setRole: (role: Role) => void;
  tick: () => Promise<void>;
}

const initialPatients: Patient[] = [
  seedPatient("P-001", "NICU-1", "Baby Noah", "Bed 01", 31),
  seedPatient("P-002", "NICU-1", "Baby Sophia", "Bed 02", 32),
  seedPatient("P-003", "NICU-2", "Baby Liam", "Bed 03", 29),
  seedPatient("P-004", "NICU-2", "Baby Emma", "Bed 04", 33),
];

type LiveFrame = NonNullable<Awaited<ReturnType<typeof fetchBackendStreamFrame>>> | SocketFrame;
let latestSocketFrame: LiveFrame | null = null;
const socketUnsubscribe = subscribeSocketFrames((frame) => {
  latestSocketFrame = frame;
});
void socketUnsubscribe;

export const useMonitorStore = create<MonitorState>((set) => ({
  role: "nurse",
  patients: initialPatients,
  dailyEventCounts: {},
  rooms: {
    "NICU-1": ["P-001", "P-002"],
    "NICU-2": ["P-003", "P-004"],
  },
  nurseAssignment: {
    primaryPatientId: "P-001",
    secondaryPatientId: "P-002",
  },
  setRole: (role) => set({ role }),
  tick: async () => {
    const streamFrame = latestSocketFrame ?? (await fetchBackendStreamFrame());
    latestSocketFrame = null;

    set((state) => {
      if (!streamFrame) {
        const patients = state.patients.map((patient) => tickPatient(patient));
        const dailyEventCounts = { ...state.dailyEventCounts };
        for (const patient of patients) {
          const latest = patient.samples[patient.samples.length - 1];
          if (latest.event !== "None") {
            dailyEventCounts[patient.id] = (dailyEventCounts[patient.id] ?? 0) + 1;
          }
        }
        return { patients, dailyEventCounts };
      }

      const patients = state.patients.map((patient) => {
        if (patient.id !== streamFrame.patient_id) {
          return tickPatient(patient);
        }

        const lastSample = patient.samples[patient.samples.length - 1];
        const next = mapBackendPayloadToSample(streamFrame, lastSample.t + 1);
        return {
          ...patient,
          roomId: streamFrame.room_id,
          samples: [...patient.samples.slice(-179), next],
        };
      });

      const nextCounts = { ...state.dailyEventCounts };
      const socketCount = (streamFrame as Partial<SocketFrame>).daily_event_count;
      nextCounts[streamFrame.patient_id] =
        typeof socketCount === "number"
          ? socketCount
          : (nextCounts[streamFrame.patient_id] ?? 0) + (streamFrame.event !== "None" ? 1 : 0);

      return { patients, dailyEventCounts: nextCounts };
    });
  },
}));
