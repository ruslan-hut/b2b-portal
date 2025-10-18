import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Product, ProductCategory } from '../models/product.model';
import { MOCK_PRODUCTS, MOCK_CATEGORIES } from '../mock-data/products.mock';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private viewModeSubject = new BehaviorSubject<'grid' | 'bulk'>('bulk');
  public viewMode$ = this.viewModeSubject.asObservable();

  constructor() { }

  getViewMode(): 'grid' | 'bulk' {
    return this.viewModeSubject.value;
  }

  setViewMode(mode: 'grid' | 'bulk'): void {
    this.viewModeSubject.next(mode);
  }

  toggleViewMode(): void {
    const currentMode = this.viewModeSubject.value;
    this.viewModeSubject.next(currentMode === 'grid' ? 'bulk' : 'grid');
  }

  getProducts(): Observable<Product[]> {
    // TODO: Replace with actual API call
    return of(MOCK_PRODUCTS).pipe(delay(500));
  }

  getProductById(id: string): Observable<Product | undefined> {
    // TODO: Replace with actual API call
    return new Observable(observer => {
      this.getProducts().subscribe(products => {
        observer.next(products.find(p => p.id === id));
        observer.complete();
      });
    });
  }

  getCategories(): Observable<ProductCategory[]> {
    // TODO: Replace with actual API call
    return of(MOCK_CATEGORIES).pipe(delay(300));
  }

  searchProducts(query: string): Observable<Product[]> {
    // TODO: Replace with actual API call
    return new Observable(observer => {
      this.getProducts().subscribe(products => {
        const filtered = products.filter(p =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase())
        );
        observer.next(filtered);
        observer.complete();
      });
    });
  }
}
