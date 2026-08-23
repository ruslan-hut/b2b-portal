import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Store } from '../models/store.model';
import { CachedLookupService } from './cached-lookup.service';

@Injectable({
  providedIn: 'root'
})
export class StoreService extends CachedLookupService<Store> {
  constructor(http: HttpClient) {
    super(http, '/store', store => store.uid);
  }

  getStores(): Observable<Record<string, Store>> {
    return this.getAll();
  }

  getStoresByUids(uids: string[]): Observable<Record<string, Store>> {
    return this.getByUids(uids);
  }
}
