import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { TranslationService } from '../../../core/services/translation.service';

interface ClientOption {
  uid: string;
  name: string;
  email?: string;
  business_registration_number?: string;
}

@Component({
  selector: 'app-order-create',
  templateUrl: './order-create.component.html',
  styleUrl: './order-create.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderCreateComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private searchSubject = new Subject<string>();

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  searchQuery = '';
  filteredClients: ClientOption[] = [];
  highlightIndex = -1;
  selectedClient: ClientOption | null = null;

  searching = false;
  saving = false;
  error: string | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.searchSubject.pipe(
        debounceTime(300),
        switchMap(query => {
          const q = query.trim();
          if (!q) {
            this.searching = false;
            return of<ClientOption[]>([]);
          }
          this.searching = true;
          this.cdr.markForCheck();
          const params = new HttpParams()
            .set('page', '1')
            .set('count', '20')
            .set('search', q);
          return this.http.get<ApiResponse<ClientOption[]>>(
            `${environment.apiUrl}/admin/clients`,
            { params }
          ).pipe(
            map(resp => resp.data || []),
            catchError(() => of<ClientOption[]>([]))
          );
        })
      ).subscribe(results => {
        this.filteredClients = results;
        this.highlightIndex = results.length > 0 ? 0 : -1;
        this.searching = false;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onSearchInput(): void {
    this.selectedClient = null;
    this.searchSubject.next(this.searchQuery);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (!this.filteredClients.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightIndex = Math.min(this.highlightIndex + 1, this.filteredClients.length - 1);
      this.cdr.markForCheck();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightIndex = Math.max(this.highlightIndex - 1, 0);
      this.cdr.markForCheck();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.highlightIndex >= 0) {
        this.selectClient(this.filteredClients[this.highlightIndex]);
      }
    }
  }

  selectClient(client: ClientOption): void {
    this.selectedClient = client;
    this.searchQuery = client.name;
    this.filteredClients = [];
    this.highlightIndex = -1;
    this.cdr.markForCheck();
  }

  clearSelection(): void {
    this.selectedClient = null;
    this.searchQuery = '';
    this.filteredClients = [];
    this.highlightIndex = -1;
    setTimeout(() => this.searchInput?.nativeElement?.focus());
    this.cdr.markForCheck();
  }

  createDraft(): void {
    if (!this.selectedClient || this.saving) return;

    this.saving = true;
    this.error = null;
    this.cdr.markForCheck();

    this.subscriptions.add(
      this.http.post<ApiResponse<{ order_uid: string; client_uid: string }>>(
        `${environment.apiUrl}/admin/orders/create`,
        { client_uid: this.selectedClient.uid }
      ).subscribe({
        next: (resp) => {
          const orderUid = resp.data?.order_uid;
          if (!orderUid) {
            this.error = 'Failed to create draft: no order UID returned';
            this.saving = false;
            this.cdr.markForCheck();
            return;
          }
          this.router.navigate(['/admin/orders', orderUid, 'edit'], {
            replaceUrl: true,
            queryParams: { from: 'new' }
          });
        },
        error: (err) => {
          console.error('Failed to create draft order:', err);
          this.error = err.error?.message || this.translationService.instant('admin.orders.create.failed');
          this.saving = false;
          this.cdr.markForCheck();
        }
      })
    );
  }

  cancel(): void {
    this.router.navigate(['/admin/orders']);
  }
}
