import { create } from 'zustand';

export interface VpnState {
  enabled: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  assignedIp: string | null;
  errorMessage: string | null;
  setEnabled: (enabled: boolean) => void;
  setStatus: (status: VpnState['status']) => void;
  setAssignedIp: (ip: string | null) => void;
  setError: (error: string | null) => void;
}

export const useVpnStore = create<VpnState>((set) => ({
  enabled: false,
  status: 'disconnected',
  assignedIp: null,
  errorMessage: null,
  setEnabled: (enabled) => set({ enabled }),
  setStatus: (status) => set({ status }),
  setAssignedIp: (assignedIp) => set({ assignedIp }),
  setError: (errorMessage) => set({ errorMessage }),
}));
