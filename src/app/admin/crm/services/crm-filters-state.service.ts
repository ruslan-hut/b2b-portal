import { Injectable } from '@angular/core';

export type CrmFilterPeriod = 'today' | '7d' | '30d' | '90d' | 'custom' | 'all';

export interface CrmFiltersState {
  storeUid: string;
  assigneeUid: string;
  period: CrmFilterPeriod;
  dateFrom: string;
  dateTo: string;
  currencyCode: string;
}

const DEFAULT_STATE: CrmFiltersState = {
  storeUid: '',
  assigneeUid: '',
  period: 'all',
  dateFrom: '',
  dateTo: '',
  currencyCode: ''
};

@Injectable({ providedIn: 'root' })
export class CrmFiltersStateService {
  private readonly prefix = 'crm-filters:';
  private readonly searchPrefix = 'crm-search:';

  load(scope: string): CrmFiltersState {
    try {
      const raw = localStorage.getItem(this.prefix + scope);
      if (!raw) return { ...DEFAULT_STATE };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STATE, ...parsed };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  save(scope: string, state: CrmFiltersState): void {
    try {
      localStorage.setItem(this.prefix + scope, JSON.stringify(state));
    } catch {
      /* ignore quota / disabled storage */
    }
  }

  clear(scope: string): void {
    try {
      localStorage.removeItem(this.prefix + scope);
    } catch {
      /* noop */
    }
  }

  // Quick-search text is kept apart from the filters state: the filters
  // component owns (and overwrites) the filters key and knows nothing about it.
  loadSearch(scope: string): string {
    try {
      return localStorage.getItem(this.searchPrefix + scope) || '';
    } catch {
      return '';
    }
  }

  saveSearch(scope: string, query: string): void {
    try {
      if (query) {
        localStorage.setItem(this.searchPrefix + scope, query);
      } else {
        localStorage.removeItem(this.searchPrefix + scope);
      }
    } catch {
      /* ignore quota / disabled storage */
    }
  }
}
