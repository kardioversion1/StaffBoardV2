export {};

declare global {
  interface ServerAPI {
    load(key: 'config' | 'roster' | 'active' | 'history', params?: Record<string, string>): Promise<any>;
    save(key: 'config' | 'roster' | 'active', payload: any): Promise<any>;
    softDeleteStaff(id: string): Promise<any>;
    exportHistoryCSV(filters?: { from?: string; to?: string; nurseId?: string }): void;
  }
  const Server: ServerAPI;
}
