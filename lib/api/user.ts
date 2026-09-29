import { api } from './client';

export interface BusyBlockInput {
  start: string;
  end: string;
}

export const userApi = {
  getBusyBlocks: () => api.get<{ id: string; startTime: string; endTime: string; source: string }[]>('/user/busy-blocks'),

  uploadBusyBlocks: (blocks: BusyBlockInput[]) =>
    api.post<{ saved: number }>('/user/busy-blocks', { blocks }),
};