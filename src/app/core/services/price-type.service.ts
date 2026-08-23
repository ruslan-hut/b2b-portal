import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PriceType } from '../models/price-type.model';
import { CachedLookupService } from './cached-lookup.service';

@Injectable({
  providedIn: 'root'
})
export class PriceTypeService extends CachedLookupService<PriceType> {
  constructor(http: HttpClient) {
    super(http, '/price_type', pt => pt.uid);
  }

  getPriceTypes(): Observable<Record<string, PriceType>> {
    return this.getAll();
  }

  getPriceTypesByUids(uids: string[]): Observable<Record<string, PriceType>> {
    return this.getByUids(uids);
  }
}
