import { create } from 'zustand';
import type { SchedulingRoom, Suggestion, RoomStats } from '../types';

interface RoomState {
  currentRoom: SchedulingRoom | null;
  suggestions: Suggestion[];
  stats: RoomStats | null;
  isLoading: boolean;
  setCurrentRoom: (room: SchedulingRoom | null) => void;
  setSuggestions: (suggestions: Suggestion[]) => void;
  setStats: (stats: RoomStats | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  currentRoom: null,
  suggestions: [],
  stats: null,
  isLoading: false,
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setSuggestions: (suggestions) => set({ suggestions }),
  setStats: (stats) => set({ stats }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
