import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Input, OnChanges, OnInit, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClientApiKeysService, MyAPIKeys } from '../../core/services/client-api-keys.service';
import { ClientAPIKey, ClientAPIKeyCreated } from '../../core/services/client-api.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { NotificationService } from '../../core/services/notification.service';
import { TranslationService } from '../../core/services/translation.service';
import { formatDateTime } from '../../core/utils/date-format';

/**
 * The client's own Client API keys, on the profile page.
 *
 * The section is always rendered. With capabilities.api_access the client
 * manages keys here; without it they get the pitch and a link to the guide,
 * because a feature nobody can see is a feature nobody asks for. Only the
 * key-management half talks to the backend — an unauthorised client never
 * fires a request that can only 403.
 */
@Component({
  selector: 'app-profile-api-keys',
  templateUrl: './profile-api-keys.component.html',
  styleUrls: ['./profile-api-keys.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileApiKeysComponent implements OnInit, OnChanges {
  /** capabilities.api_access — false renders the locked state instead. */
  @Input() access = false;

  private readonly api = inject(ClientApiKeysService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly notifications = inject(NotificationService);
  private readonly t = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  loading = true;
  error: string | null = null;
  data: MyAPIKeys | null = null;

  showCreate = false;
  creating = false;
  newName = '';
  newScopes: string[] = ['catalog:read', 'orders:read'];
  newIsTest = false;

  created: ClientAPIKeyCreated | null = null;
  copied = false;

  renamingUid: string | null = null;
  renameValue = '';

  ngOnInit(): void { if (this.access) { this.load(); } else { this.loading = false; } }

  /**
   * The profile refreshes app settings after the first render, so access can
   * flip to true a moment after the section is drawn; load the keys then.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['access'] && !changes['access'].firstChange) {
      if (this.access && !this.data) { this.load(); }
      if (!this.access) { this.data = null; this.loading = false; this.cdr.markForCheck(); }
    }
  }

  load(): void {
    this.loading = true; this.error = null; this.cdr.markForCheck();
    this.api.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: d => { this.data = d; this.loading = false; this.cdr.markForCheck(); },
      error: e => {
        this.loading = false;
        // 403 = access switched off since the settings were loaded: hide quietly.
        this.error = e?.status === 403 ? null : (e?.error?.error?.message || this.t.instant('common.error'));
        this.data = e?.status === 403 ? null : this.data;
        this.cdr.markForCheck();
      }
    });
  }

  get canCreate(): boolean { return !!this.data && this.data.active_keys < this.data.max_keys; }
  isActive(k: ClientAPIKey): boolean { return k.status === 'active' && new Date(k.expires_at).getTime() > Date.now(); }
  formatDate(v?: string | null): string { return v ? formatDateTime(v) : '—'; }
  displayPrefix(k: ClientAPIKey): string { return `cmx_${k.is_test ? 'test' : 'live'}_${k.key_prefix}_…`; }

  openCreate(): void {
    this.newName = ''; this.newScopes = ['catalog:read', 'orders:read']; this.newIsTest = false;
    this.showCreate = true; this.cdr.markForCheck();
  }
  closeCreate(): void { this.showCreate = false; this.cdr.markForCheck(); }
  hasScope(s: string): boolean { return this.newScopes.includes(s); }
  toggleScope(s: string): void {
    this.newScopes = this.hasScope(s) ? this.newScopes.filter(x => x !== s) : [...this.newScopes, s];
  }

  create(): void {
    const name = this.newName.trim();
    if (!name || this.creating) return;
    this.creating = true; this.cdr.markForCheck();
    this.api.create(name, this.newScopes, this.newIsTest).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: c => { this.creating = false; this.showCreate = false; this.created = c; this.copied = false; this.load(); },
      error: e => { this.creating = false; this.notifications.error(e?.error?.error?.message || this.t.instant('common.error')); this.cdr.markForCheck(); }
    });
  }

  copyCreated(): void {
    if (!this.created) return;
    navigator.clipboard?.writeText(this.created.plaintext_key).then(() => { this.copied = true; this.cdr.markForCheck(); });
  }
  closeCreated(): void { this.created = null; this.cdr.markForCheck(); }

  startRename(k: ClientAPIKey): void { this.renamingUid = k.uid; this.renameValue = k.name; this.cdr.markForCheck(); }
  cancelRename(): void { this.renamingUid = null; this.cdr.markForCheck(); }
  saveRename(k: ClientAPIKey): void {
    const name = this.renameValue.trim();
    if (!name) return;
    this.api.rename(k.uid, name).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.renamingUid = null; this.load(); },
      error: e => this.notifications.error(e?.error?.error?.message || this.t.instant('common.error'))
    });
  }

  async revoke(k: ClientAPIKey): Promise<void> {
    if (!await this.confirm.ask({ message: this.t.instant('profile.apiKeys.revokeConfirm', { name: k.name }), danger: true })) return;
    this.api.revoke(k.uid).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.notifications.success(this.t.instant('profile.apiKeys.revoked')); this.load(); },
      error: e => this.notifications.error(e?.error?.error?.message || this.t.instant('common.error'))
    });
  }

  async rotate(k: ClientAPIKey): Promise<void> {
    if (!await this.confirm.ask({ message: this.t.instant('profile.apiKeys.rotateConfirm', { name: k.name }) })) return;
    this.api.rotate(k.uid).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: c => { this.created = c; this.copied = false; this.load(); },
      error: e => this.notifications.error(e?.error?.error?.message || this.t.instant('common.error'))
    });
  }
}
