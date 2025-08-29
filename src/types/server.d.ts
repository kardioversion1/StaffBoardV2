import type { Config, Staff, ActiveBoard } from '@/state';
import type { PublishedShiftSnapshot } from '@/state/history';

export {};

declare global {
  interface HistoryQueryList {
    mode: 'list';
    date: string;
  }
  interface HistoryQueryByNurse {
    mode: 'byNurse';
    nurseId: string;
  }
  type HistoryQuery = HistoryQueryList | HistoryQueryByNurse;

  interface ServerAPI {
    /**
     * Load persisted configuration.
     * @example
     * const cfg = await Server.load('config');
     */
    load(key: 'config'): Promise<Config>;
    /**
     * Load the staff roster.
     * @example
     * const staff = await Server.load('roster');
     * staff[0].id;
     */
    load(key: 'roster'): Promise<Staff[]>;
    /**
     * Load an active board snapshot.
     * @example
     * const board = await Server.load('active', { date: '2024-01-01', shift: 'day' });
     */
    load(key: 'active', params?: { date?: string; shift?: 'day' | 'night' }): Promise<ActiveBoard | undefined>;
    /**
     * Query published history snapshots.
     * @example
     * const hist = await Server.load('history', { mode: 'list', date: '2024-01-01' });
     */
    load(key: 'history', params: HistoryQuery): Promise<PublishedShiftSnapshot[]>;

    /**
     * Persist configuration.
     * @example
     * await Server.save('config', cfg);
     */
    save(key: 'config', payload: Config): Promise<void>;
    /**
     * Persist the staff roster.
     * @example
     * await Server.save('roster', staff);
     */
    save(key: 'roster', payload: Staff[]): Promise<void>;
    /**
     * Persist the active board.
     * @example
     * await Server.save('active', board);
     */
    save(
      key: 'active',
      payload: ActiveBoard,
      params?: { appendHistory?: boolean }
    ): Promise<void>;

    softDeleteStaff(id: string): Promise<void>;
    exportHistoryCSV(filters?: { from?: string; to?: string; nurseId?: string }): void;
  }
  const Server: ServerAPI;
}
