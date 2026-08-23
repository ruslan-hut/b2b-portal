import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { TranslationService } from '../../core/services/translation.service';
import { environment } from '../../../environments/environment';
import {
  ClientApiService, ClientAPIKeyListItem, ClientAPIKeyCreated, ClientAPISettings, ClientAPIStoreAccess,
  ClientAPIRequestRow, ClientAPIUsageHour, ClientAPIKeyFilter, ClientAPIRequestFilter, CLIENT_API_SCOPES
} from '../../core/services/client-api.service';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { PageTitleService } from '../../core/services/page-title.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { NotificationService } from '../../core/services/notification.service';
import { formatDateTime } from '../../core/utils/date-format';

type Tab = 'keys' | 'requests' | 'usage' | 'settings';

interface ClientPick { uid: string; name: string; store_uid?: string; }

interface UsageBucket { hour: string; requests: number; errors: number; }
interface UsageRoute { route: string; requests: number; errors: number; avg: number; }

@Component({
  selector: 'app-client-api',
  templateUrl: './client-api.component.html',
  styleUrls: ['./client-api.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientApiComponent implements OnInit, OnDestroy {
  private subs = new Subscription();
  readonly scopes = CLIENT_API_SCOPES;

  tab: Tab = 'keys';
  loading = false;
  error: string | null = null;
  stores: any[] = [];
  isAdmin = false;

  // ---- keys ----
  keys: ClientAPIKeyListItem[] = [];
  keysPage = 1;
  keysPerPage = 25;
  keysTotal = 0;
  keysTotalPages = 1;
  keyFilter: ClientAPIKeyFilter = { status: '', client_uid: '', store_uid: '', scope: '', is_test: null, expiring_days: null, search: '' };
  showKeyFilters = false;

  // key dialog
  showKeyDialog = false;
  editingKey: ClientAPIKeyListItem | null = null;
  keyForm: FormGroup;
  keySaving = false;
  clientQuery$ = new Subject<string>();
  clientResults: ClientPick[] = [];
  pickedClient: ClientPick | null = null;

  // show-once dialog
  createdKey: ClientAPIKeyCreated | null = null;
  createdKeyCopied = false;

  // ---- requests ----
  requests: ClientAPIRequestRow[] = [];
  requestsPage = 1;
  requestsPerPage = 50;
  requestsTotal = 0;
  requestsTotalPages = 1;
  requestFilter: ClientAPIRequestFilter = { key_uid: '', client_uid: '', request_id: '', route: '', status_min: null, status_max: null, from: '', to: '' };
  showRequestFilters = false;

  // ---- usage ----
  usageDays = 7;
  usageKeyUid = '';
  usageClientUid = '';
  usageBuckets: UsageBucket[] = [];
  usageRoutes: UsageRoute[] = [];
  usageTotals = { requests: 0, ok: 0, errors4xx: 0, throttled: 0, errors5xx: 0, avg: 0 };
  usageMax = 1;

  // ---- settings ----
  settings: ClientAPISettings | null = null;
  settingsForm: FormGroup;
  settingsSaving = false;
  storeAccess: ClientAPIStoreAccess[] = [];

  constructor(
    private api: ClientApiService,
    private adminService: AdminService,
    private auth: AuthService,
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private pageTitle: PageTitleService,
    private confirm: ConfirmDialogService,
    private notifications: NotificationService,
    private t: TranslationService
  ) {
    this.keyForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      scopes: [['catalog:read', 'orders:read']],
      is_test: [false],
      ttl_days: [null],
      rate_limit_read: [null],
      rate_limit_write: [null]
    });
    this.settingsForm = this.fb.group({
      enabled: [false],
      stores_enabled_by_default: [true],
      self_service_enabled: [true],
      max_keys_per_client: [5, [Validators.required, Validators.min(1), Validators.max(100)]],
      default_key_ttl_days: [365, [Validators.required, Validators.min(1), Validators.max(3650)]],
      max_key_ttl_days: [730, [Validators.required, Validators.min(1), Validators.max(3650)]],
      default_read_rpm: [600, [Validators.required, Validators.min(1)]],
      default_write_rpm: [60, [Validators.required, Validators.min(1)]],
      rotation_grace_hours: [24, [Validators.required, Validators.min(0), Validators.max(720)]],
      request_log_retention_days: [30, [Validators.required, Validators.min(1)]],
      usage_retention_days: [365, [Validators.required, Validators.min(1)]],
      expiry_warn_days: [7, [Validators.required, Validators.min(1), Validators.max(365)]],
      alert_key_events: [true],
      auth_failure_limit: [20, [Validators.required, Validators.min(1)]],
      auth_failure_window_minutes: [10, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    this.pageTitle.setTitle('Client API');
    this.isAdmin = this.auth.isAdmin;
    this.tab = this.tabFromUrl();
    const q = this.route.snapshot.queryParamMap;
    if (q.get('client_uid')) {
      this.keyFilter.client_uid = q.get('client_uid')!;
      this.requestFilter.client_uid = q.get('client_uid')!;
      this.usageClientUid = q.get('client_uid')!;
      this.showKeyFilters = true;
    }
    if (q.get('key_uid')) {
      this.requestFilter.key_uid = q.get('key_uid')!;
      this.usageKeyUid = q.get('key_uid')!;
      this.showRequestFilters = true;
    }
    this.subs.add(this.adminService.listStores().subscribe({
      next: s => { this.stores = s || []; this.cdr.markForCheck(); },
      error: () => {}
    }));
    this.subs.add(this.clientQuery$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => q.trim().length < 2 ? of([]) : this.searchClients(q.trim()))
    ).subscribe(list => { this.clientResults = list; this.cdr.markForCheck(); }));
    this.loadTab();
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  private tabFromUrl(): Tab {
    const seg = this.router.url.split('?')[0].split('/').pop() || 'keys';
    return (['keys', 'requests', 'usage', 'settings'] as Tab[]).includes(seg as Tab) ? (seg as Tab) : 'keys';
  }

  loadTab(): void {
    switch (this.tab) {
      case 'keys': this.loadKeys(); break;
      case 'requests': this.loadRequests(); break;
      case 'usage': this.loadUsage(); break;
      case 'settings': this.loadSettings(); break;
    }
  }

  refresh(): void { this.loadTab(); }

  formatDate(v?: string | null): string { return v ? formatDateTime(v) : '—'; }
  storeName(uid?: string): string { return this.stores.find(s => s.uid === uid)?.name || uid || '—'; }

  private fail(err: any, fallback: string): void {
    this.loading = false;
    this.error = err?.error?.error?.message || err?.error?.status_message || this.t.instant(fallback);
    this.cdr.markForCheck();
  }

  // ------------------------------------------------------------------ keys

  loadKeys(): void {
    this.loading = true; this.error = null; this.cdr.markForCheck();
    const offset = (this.keysPage - 1) * this.keysPerPage;
    this.subs.add(this.api.listKeys(this.keyFilter, offset, this.keysPerPage).subscribe({
      next: r => {
        this.keys = r.data || [];
        this.keysTotal = r.pagination?.total ?? this.keys.length;
        this.keysTotalPages = r.pagination?.total_pages || 1;
        this.loading = false; this.cdr.markForCheck();
      },
      error: e => this.fail(e, 'admin.clientApi.loadFailed')
    }));
  }

  applyKeyFilters(): void { this.keysPage = 1; this.loadKeys(); }
  clearKeyFilters(): void {
    this.keyFilter = { status: '', client_uid: '', store_uid: '', scope: '', is_test: null, expiring_days: null, search: '' };
    this.applyKeyFilters();
  }
  goKeysPage(p: number): void { if (p >= 1 && p <= this.keysTotalPages) { this.keysPage = p; this.loadKeys(); } }

  keyState(k: ClientAPIKeyListItem): 'active' | 'revoked' | 'expired' | 'expiring' {
    if (k.status === 'revoked') return 'revoked';
    const exp = new Date(k.expires_at).getTime();
    if (exp <= Date.now()) return 'expired';
    const warn = (this.settings?.expiry_warn_days ?? 7) * 86400_000;
    return exp - Date.now() <= warn ? 'expiring' : 'active';
  }

  openNewKey(client?: ClientPick): void {
    this.editingKey = null;
    this.pickedClient = client || null;
    this.clientResults = [];
    this.keyForm.reset({ name: '', scopes: ['catalog:read', 'orders:read'], is_test: false, ttl_days: null, rate_limit_read: null, rate_limit_write: null });
    this.showKeyDialog = true;
    this.cdr.markForCheck();
  }

  openEditKey(k: ClientAPIKeyListItem): void {
    this.editingKey = k;
    this.pickedClient = { uid: k.client_uid, name: k.client_name, store_uid: k.store_uid };
    this.keyForm.reset({
      name: k.name, scopes: [...k.scopes], is_test: k.is_test, ttl_days: null,
      rate_limit_read: k.rate_limit_read || null, rate_limit_write: k.rate_limit_write || null
    });
    this.showKeyDialog = true;
    this.cdr.markForCheck();
  }

  closeKeyDialog(): void { this.showKeyDialog = false; this.cdr.markForCheck(); }

  onClientQuery(q: string): void { this.clientQuery$.next(q); }
  pickClient(c: ClientPick): void { this.pickedClient = c; this.clientResults = []; this.cdr.markForCheck(); }
  clearClient(): void { this.pickedClient = null; this.cdr.markForCheck(); }

  private searchClients(q: string) {
    return this.http.get<any>(`${environment.apiUrl}/admin/clients?page=1&count=10&search=${encodeURIComponent(q)}`).pipe(
      switchMap(r => of((r.data || []).map((c: any) => ({ uid: c.uid, name: c.name, store_uid: c.store_uid }) as ClientPick))),
      catchError(() => of([]))
    );
  }

  hasScope(s: string): boolean { return (this.keyForm.value.scopes || []).includes(s); }
  toggleScope(s: string): void {
    const cur: string[] = [...(this.keyForm.value.scopes || [])];
    const i = cur.indexOf(s);
    if (i >= 0) cur.splice(i, 1); else cur.push(s);
    this.keyForm.patchValue({ scopes: cur });
  }

  saveKey(): void {
    if (this.keyForm.invalid) { this.keyForm.markAllAsTouched(); return; }
    const v = this.keyForm.value;
    this.keySaving = true; this.cdr.markForCheck();
    if (this.editingKey) {
      this.subs.add(this.api.updateKey({
        uid: this.editingKey.uid, name: v.name, scopes: v.scopes, is_test: v.is_test,
        rate_limit_read: v.rate_limit_read || 0, rate_limit_write: v.rate_limit_write || 0
      }).subscribe({
        next: () => {
          this.keySaving = false; this.showKeyDialog = false;
          this.notifications.success(this.t.instant('admin.clientApi.keyUpdated'));
          this.loadKeys();
        },
        error: e => { this.keySaving = false; this.notifications.error(this.errMsg(e)); this.cdr.markForCheck(); }
      }));
      return;
    }
    if (!this.pickedClient) { this.notifications.error(this.t.instant('admin.clientApi.pickClient')); this.keySaving = false; return; }
    this.subs.add(this.api.createKey({
      client_uid: this.pickedClient.uid, name: v.name, scopes: v.scopes, is_test: !!v.is_test,
      ttl_days: v.ttl_days || 0, rate_limit_read: v.rate_limit_read || 0, rate_limit_write: v.rate_limit_write || 0
    }).subscribe({
      next: created => {
        this.keySaving = false; this.showKeyDialog = false;
        this.createdKey = created; this.createdKeyCopied = false;
        this.loadKeys();
      },
      error: e => { this.keySaving = false; this.notifications.error(this.errMsg(e)); this.cdr.markForCheck(); }
    }));
  }

  async revokeKey(k: ClientAPIKeyListItem): Promise<void> {
    const ok = await this.confirm.ask({ message: this.t.instant('admin.clientApi.revokeConfirm', { name: k.name }), danger: true });
    if (!ok) return;
    this.subs.add(this.api.revokeKey(k.uid, 'revoked from admin panel').subscribe({
      next: () => { this.notifications.success(this.t.instant('admin.clientApi.keyRevoked')); this.loadKeys(); },
      error: e => this.notifications.error(this.errMsg(e))
    }));
  }

  async rotateKey(k: ClientAPIKeyListItem): Promise<void> {
    const ok = await this.confirm.ask({ message: this.t.instant('admin.clientApi.rotateConfirm', { name: k.name }) });
    if (!ok) return;
    this.subs.add(this.api.rotateKey(k.uid).subscribe({
      next: created => { this.createdKey = created; this.createdKeyCopied = false; this.loadKeys(); },
      error: e => this.notifications.error(this.errMsg(e))
    }));
  }

  copyCreatedKey(): void {
    if (!this.createdKey) return;
    navigator.clipboard?.writeText(this.createdKey.plaintext_key).then(() => {
      this.createdKeyCopied = true; this.cdr.markForCheck();
    });
  }
  closeCreatedKey(): void { this.createdKey = null; this.cdr.markForCheck(); }

  viewKeyRequests(k: ClientAPIKeyListItem): void {
    this.router.navigate(['/admin/client-api/requests'], { queryParams: { key_uid: k.uid } }).then(() => {
      this.tab = 'requests'; this.requestFilter = { ...this.requestFilter, key_uid: k.uid }; this.showRequestFilters = true; this.loadRequests();
    });
  }

  private errMsg(e: any): string {
    return e?.error?.error?.message || e?.error?.status_message || this.t.instant('common.error');
  }

  // ------------------------------------------------------------------ requests

  loadRequests(): void {
    this.loading = true; this.error = null; this.cdr.markForCheck();
    const offset = (this.requestsPage - 1) * this.requestsPerPage;
    this.subs.add(this.api.listRequests(this.requestFilter, offset, this.requestsPerPage).subscribe({
      next: r => {
        this.requests = r.data || [];
        this.requestsTotal = r.pagination?.total ?? this.requests.length;
        this.requestsTotalPages = r.pagination?.total_pages || 1;
        this.loading = false; this.cdr.markForCheck();
      },
      error: e => this.fail(e, 'admin.clientApi.loadFailed')
    }));
  }
  applyRequestFilters(): void { this.requestsPage = 1; this.loadRequests(); }
  clearRequestFilters(): void {
    this.requestFilter = { key_uid: '', client_uid: '', request_id: '', route: '', status_min: null, status_max: null, from: '', to: '' };
    this.applyRequestFilters();
  }
  goRequestsPage(p: number): void { if (p >= 1 && p <= this.requestsTotalPages) { this.requestsPage = p; this.loadRequests(); } }
  statusClass(code: number): string {
    if (code >= 500) return 'is-5xx';
    if (code === 429) return 'is-429';
    if (code >= 400) return 'is-4xx';
    return 'is-2xx';
  }
  shortRoute(route: string): string { return route.replace(/^\/api\/client\/v1/, '') || '/'; }

  // ------------------------------------------------------------------ usage

  loadUsage(): void {
    this.loading = true; this.error = null; this.cdr.markForCheck();
    const from = new Date(Date.now() - this.usageDays * 86400_000);
    from.setMinutes(0, 0, 0);
    this.subs.add(this.api.listUsage({ key_uid: this.usageKeyUid, client_uid: this.usageClientUid, from: from.toISOString() }).subscribe({
      next: rows => { this.aggregateUsage(rows); this.loading = false; this.cdr.markForCheck(); },
      error: e => this.fail(e, 'admin.clientApi.loadFailed')
    }));
  }

  private aggregateUsage(rows: ClientAPIUsageHour[]): void {
    const byHour = new Map<string, UsageBucket>();
    const byRoute = new Map<string, { requests: number; errors: number; dur: number }>();
    const t = { requests: 0, ok: 0, errors4xx: 0, throttled: 0, errors5xx: 0, dur: 0 };
    for (const r of rows) {
      const err = r.status_4xx + r.status_429 + r.status_5xx;
      const b = byHour.get(r.hour) || { hour: r.hour, requests: 0, errors: 0 };
      b.requests += r.requests; b.errors += err; byHour.set(r.hour, b);
      const rt = byRoute.get(r.route) || { requests: 0, errors: 0, dur: 0 };
      rt.requests += r.requests; rt.errors += err; rt.dur += r.avg_duration_ms * r.requests; byRoute.set(r.route, rt);
      t.requests += r.requests; t.ok += r.status_2xx; t.errors4xx += r.status_4xx; t.throttled += r.status_429; t.errors5xx += r.status_5xx;
      t.dur += r.avg_duration_ms * r.requests;
    }
    // Fill the hour axis so quiet hours are visible as gaps, not missing.
    const buckets: UsageBucket[] = [];
    const start = new Date(Date.now() - this.usageDays * 86400_000); start.setMinutes(0, 0, 0);
    const step = this.usageDays > 2 ? 24 : 1; // per-day bars for long ranges
    if (step === 24) {
      const byDay = new Map<string, UsageBucket>();
      for (const b of byHour.values()) {
        const day = b.hour.slice(0, 10);
        const d = byDay.get(day) || { hour: day, requests: 0, errors: 0 };
        d.requests += b.requests; d.errors += b.errors; byDay.set(day, d);
      }
      for (let i = 0; i <= this.usageDays; i++) {
        const d = new Date(start.getTime() + i * 86400_000).toISOString().slice(0, 10);
        buckets.push(byDay.get(d) || { hour: d, requests: 0, errors: 0 });
      }
    } else {
      for (let h = new Date(start); h.getTime() <= Date.now(); h = new Date(h.getTime() + 3600_000)) {
        const key = h.toISOString().slice(0, 13);
        const found = [...byHour.values()].find(b => b.hour.startsWith(key));
        buckets.push(found || { hour: h.toISOString(), requests: 0, errors: 0 });
      }
    }
    this.usageBuckets = buckets;
    this.usageMax = Math.max(1, ...buckets.map(b => b.requests));
    this.usageRoutes = [...byRoute.entries()]
      .map(([route, v]) => ({ route, requests: v.requests, errors: v.errors, avg: v.requests ? Math.round(v.dur / v.requests) : 0 }))
      .sort((a, b) => b.requests - a.requests);
    this.usageTotals = { ...t, avg: t.requests ? Math.round(t.dur / t.requests) : 0 };
  }

  barHeight(n: number): string { return `${Math.max(2, Math.round((n / this.usageMax) * 100))}%`; }
  bucketLabel(b: UsageBucket): string {
    return b.hour.length <= 10 ? b.hour.slice(5) : new Date(b.hour).getHours().toString().padStart(2, '0');
  }
  setUsageDays(d: number): void { this.usageDays = d; this.loadUsage(); }

  // ------------------------------------------------------------------ settings

  loadSettings(): void {
    this.loading = true; this.error = null; this.cdr.markForCheck();
    this.subs.add(this.api.getSettings().subscribe({
      next: s => {
        this.settings = s;
        this.settingsForm.patchValue(s);
        this.loading = false; this.cdr.markForCheck();
        this.subs.add(this.api.listStoreAccess().subscribe({ next: rows => { this.storeAccess = rows; this.cdr.markForCheck(); }, error: () => {} }));
      },
      error: e => this.fail(e, 'admin.clientApi.loadFailed')
    }));
  }

  saveSettings(): void {
    if (this.settingsForm.invalid) { this.settingsForm.markAllAsTouched(); return; }
    this.settingsSaving = true; this.cdr.markForCheck();
    this.subs.add(this.api.updateSettings(this.settingsForm.value).subscribe({
      next: s => {
        this.settings = s; this.settingsForm.patchValue(s); this.settingsSaving = false;
        this.notifications.success(this.t.instant('admin.clientApi.settingsSaved'));
        this.cdr.markForCheck();
      },
      error: e => { this.settingsSaving = false; this.notifications.error(this.errMsg(e)); this.cdr.markForCheck(); }
    }));
  }

  storeEnabled(storeUid: string): boolean {
    const row = this.storeAccess.find(a => a.store_uid === storeUid);
    return row ? row.enabled : !!this.settings?.stores_enabled_by_default;
  }
  storeExplicit(storeUid: string): boolean { return this.storeAccess.some(a => a.store_uid === storeUid); }
  toggleStore(storeUid: string): void {
    const next = !this.storeEnabled(storeUid);
    this.subs.add(this.api.setStoreAccess(storeUid, next).subscribe({
      next: row => {
        this.storeAccess = [...this.storeAccess.filter(a => a.store_uid !== storeUid), row];
        this.cdr.markForCheck();
      },
      error: e => this.notifications.error(this.errMsg(e))
    }));
  }
}
