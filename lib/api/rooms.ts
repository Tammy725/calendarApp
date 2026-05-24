import { api } from './client';
import type { SchedulingRoom, CreateRoomInput, RoomParticipant, Suggestion, RoomStats } from '../types';

export const roomsApi = {
  list: () => api.get<SchedulingRoom[]>('/rooms'),

  get: (id: string) => api.get<SchedulingRoom>(`/rooms/${id}`),

  create: (input: CreateRoomInput) =>
    api.post<SchedulingRoom>('/rooms', input),

  update: (id: string, data: Partial<CreateRoomInput & { status: string }>) =>
    api.patch<SchedulingRoom>(`/rooms/${id}`, data),

  delete: (id: string) => api.delete<{ message: string }>(`/rooms/${id}`),

  invite: (id: string, email: string) =>
    api.post<RoomParticipant>(`/rooms/${id}/invite`, { email }),

  join: (id: string) =>
    api.post<RoomParticipant>(`/rooms/${id}/join`),

  leave: (id: string) =>
    api.delete<{ message: string }>(`/rooms/${id}/leave`),

  computeAvailability: (roomId: string) =>
    api.post<{ suggestions: Suggestion[]; total: number }>(`/availability/compute/${roomId}`),

  getSuggestions: (roomId: string) =>
    api.get<Suggestion[]>(`/availability/suggestions/${roomId}`),

  getStats: (roomId: string) =>
    api.get<RoomStats>(`/availability/stats/${roomId}`),

  finalize: (roomId: string, suggestionId: string) =>
    api.post<{ message: string }>(`/availability/finalize/${roomId}`, { suggestionId }),
};
