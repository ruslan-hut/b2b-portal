import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Subscription } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { PageTitleService } from '../../../core/services/page-title.service';
import { TranslationService } from '../../../core/services/translation.service';
import { StoreService } from '../../../core/services/store.service';
import { PriceTypeService } from '../../../core/services/price-type.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { AuthService } from '../../../core/services/auth.service';
import { Store } from '../../../core/models/store.model';
import { PriceType } from '../../../core/models/price-type.model';
import { formatDateTime } from '../../../core/utils/date-format';
import { AdminUser } from '../users.component';
import { KNOWN_ROLES } from '../../../core/models/user.model';

type EditForm = Partial<AdminUser> & {
  password: string;
  confirmPassword: string;
};

@Component({
  selector: 'app-user-edit',
  templateUrl: './user-edit.component.html',
  styleUrls: ['./user-edit.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserEditComponent implements OnInit, OnDestroy {
  private subs = new Subscription();

  isCreating = false;
  loading = false;
  saving = false;
  error: string | null = null;

  user: AdminUser | null = null;
  form: EditForm = this.emptyForm();
  sendPasswordEmail = false;
  showPassword = false;

  stores: Store[] = [];
  priceTypes: PriceType[] = [];

  /**
   * Assignable roles, mirroring `entity.StaffRoles` on the backend, which
   * rejects anything else on write.
   *
   * The retired "user" and "client" values are gone: no authorization gate
   * ever read them, so those accounts could log in and reach nothing. Use the
   * active toggle to park an account instead.
   */
  roleOptions = [
    { value: 'admin', labelKey: 'admin.users.roleAdmin' },
    { value: 'manager', labelKey: 'admin.users.roleManager' },
    { value: 'content_editor', labelKey: 'admin.users.roleContentEditor' },
  ];

  /**
   * The role this user arrived with, when it is one the backend no longer
   * accepts. Kept so the form can say what it was instead of silently
   * presenting an empty picker — the admin has to choose a real role to save.
   */
  legacyRole: string | null = null;

  /**
   * Content editors maintain partner material across every market, so they stay
   * global in the operational sense: `isStoreScopedManager()` (frontend) and
   * `UserAuth.IsStoreScoped` (backend) both exclude the role explicitly, so a
   * store here never becomes a filter on what they may see or edit.
   *
   * What it does mean is the catalog-preview context: the client-area preview
   * needs a store and a price type to resolve an assortment and prices, and it
   * reads them off the user row. A content editor without both gets the
   * "configuration missing" banner instead of a catalog, which is why the
   * section is offered to them and the sub-label says what the values are for.
   */
  get isContentEditorRole(): boolean {
    return this.form.role === 'content_editor';
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private pageTitle: PageTitleService,
    private translation: TranslationService,
    private storeService: StoreService,
    private priceTypeService: PriceTypeService,
    private confirmDialog: ConfirmDialogService,
    private auth: AuthService,
  ) {}

  /**
   * Blocking yourself would revoke your own tokens mid-session and, if you are
   * the only admin, lock the platform. The toggle is disabled on your own row.
   */
  get isSelf(): boolean {
    return !this.isCreating && !!this.user && this.user.uid === this.auth.currentUser?.uid;
  }

  private t(key: string, params?: { [k: string]: string | number }): string {
    return this.translation.instant(key, params);
  }

  ngOnInit(): void {
    const uid = this.route.snapshot.paramMap.get('uid');
    this.isCreating = !uid || uid === 'new';
    this.pageTitle.setTitle(
      this.t(this.isCreating ? 'admin.users.createUser' : 'admin.users.editUser'),
    );

    this.loading = true;
    this.subs.add(
      forkJoin({
        stores: this.storeService.getStores(),
        priceTypes: this.priceTypeService.getPriceTypes(),
      }).subscribe({
        next: ({ stores, priceTypes }) => {
          this.stores = Object.values(stores).sort((a, b) =>
            (a.name || '').localeCompare(b.name || ''),
          );
          this.priceTypes = Object.values(priceTypes).sort((a, b) =>
            (a.name || '').localeCompare(b.name || ''),
          );
          if (this.isCreating) {
            this.loading = false;
            this.cdr.detectChanges();
          } else {
            this.loadUser(uid!);
          }
        },
        error: () => {
          this.error = this.t('admin.users.errLoadRefData');
          this.loading = false;
          this.cdr.detectChanges();
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private loadUser(uid: string): void {
    const fromState = history.state?.user as AdminUser | undefined;
    if (fromState && fromState.uid === uid) {
      this.applyUser(fromState);
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }
    this.subs.add(
      this.http
        .post<ApiResponse<AdminUser[]>>(`${environment.apiUrl}/admin/user/batch`, {
          data: [uid],
        })
        .subscribe({
          next: (res) => {
            const u = (res.data || [])[0];
            if (!u) {
              this.error = this.t('admin.users.errUserNotFound');
            } else {
              this.applyUser(u);
            }
            this.loading = false;
            this.cdr.detectChanges();
          },
          error: () => {
            this.error = this.t('admin.users.errLoadUser');
            this.loading = false;
            this.cdr.detectChanges();
          },
        }),
    );
  }

  private applyUser(u: AdminUser): void {
    this.user = u;
    // A retired role is surfaced, not carried forward: leaving it in the form
    // would let a save bounce off backend validation with nothing on screen
    // explaining why. Blanking the picker forces a deliberate choice.
    const known = (KNOWN_ROLES as readonly string[]).includes(u.role);
    this.legacyRole = known ? null : u.role;
    this.form = {
      ...u,
      role: known ? u.role : '',
      // Rows written before the column existed come back without the flag and
      // are active server-side. Normalise so the toggle never renders blank.
      active: u.active !== false,
      password: '',
      confirmPassword: '',
    };
  }

  private emptyForm(): EditForm {
    return {
      username: '',
      email: '',
      first_name: '',
      last_name: '',
      // Manager is the least-privileged assignable role and what the ERP
      // creates, so it is the safe default for a new account. It used to be
      // 'user', which the backend now rejects.
      role: 'manager',
      active: true,
      store_uid: '',
      price_type_uid: '',
      receive_email_notifications: false,
      all_orders: false,
      password: '',
      confirmPassword: '',
    };
  }

  initials(): string {
    const f = (this.form.first_name || '').trim();
    const l = (this.form.last_name || '').trim();
    if (f || l) {
      return ((f[0] || '') + (l[0] || '')).toUpperCase();
    }
    const u = (this.form.username || '').trim();
    return u ? u.substring(0, 2).toUpperCase() : '·';
  }

  storeName(uid: string | undefined): string {
    if (!uid) return '';
    return this.stores.find((s) => s.uid === uid)?.name || uid;
  }

  priceTypeName(uid: string | undefined): string {
    if (!uid) return '';
    return this.priceTypes.find((p) => p.uid === uid)?.name || uid;
  }

  formatDate(d?: string): string {
    return formatDateTime(d);
  }

  generatePassword(): void {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const buf = new Uint32Array(16);
    crypto.getRandomValues(buf);
    let p = '';
    for (let i = 0; i < 16; i++) p += chars[buf[i] % chars.length];
    this.form.password = p;
    this.form.confirmPassword = p;
    this.showPassword = true;
    this.cdr.detectChanges();
  }

  copyPassword(): void {
    if (!this.form.password) return;
    navigator.clipboard.writeText(this.form.password);
  }

  back(): void {
    this.router.navigate(['/admin/users']);
  }

  save(): void {
    this.error = null;

    if (!this.form.role && this.legacyRole) {
      this.error = this.t('admin.users.errLegacyRolePickOne', { role: this.legacyRole });
      return;
    }
    if (!this.form.username || !this.form.role) {
      this.error = this.t('admin.users.errUsernameRoleRequired');
      return;
    }
    if (this.isCreating && !this.form.password) {
      this.error = this.t('admin.users.errPasswordRequiredNew');
      return;
    }
    if (this.form.password && this.form.password !== this.form.confirmPassword) {
      this.error = this.t('admin.users.errPasswordsDoNotMatch');
      return;
    }

    const payload: any = {
      uid: this.user?.uid || '',
      username: this.form.username,
      email: this.form.email || '',
      first_name: this.form.first_name || '',
      last_name: this.form.last_name || '',
      role: this.form.role,
      // Always sent explicitly. The backend reads an absent `active` as
      // "leave as stored", which would make the toggle a no-op.
      active: this.form.active !== false,
      store_uid: this.form.store_uid || '',
      price_type_uid: this.form.price_type_uid || '',
      receive_email_notifications: !!this.form.receive_email_notifications,
      all_orders: !!this.form.all_orders,
    };

    if (this.form.password && this.form.password.trim() !== '') {
      payload.password = this.form.password;
      if (
        this.sendPasswordEmail &&
        this.form.email &&
        this.form.email.trim() !== ''
      ) {
        payload.send_password_email = true;
      }
    } else if (this.isCreating) {
      payload.password = '';
    }

    this.saving = true;
    this.subs.add(
      this.http
        .post<ApiResponse<string[]>>(`${environment.apiUrl}/admin/user`, {
          data: [payload],
        })
        .subscribe({
          next: () => {
            this.saving = false;
            this.router.navigate(['/admin/users']);
          },
          error: (err) => {
            const reason = err.error?.message || err.message || '';
            this.error = reason
              ? `${this.t('admin.users.errSaveUser')}: ${reason}`
              : this.t('admin.users.errSaveUser');
            this.saving = false;
            this.cdr.detectChanges();
          },
        }),
    );
  }

  async remove(): Promise<void> {
    if (!this.user) return;
    const msg = this.t('admin.users.deleteConfirm', { name: this.user.username });
    if (!await this.confirmDialog.ask({ message: msg, danger: true })) return;
    this.subs.add(
      this.http
        .post(`${environment.apiUrl}/admin/user/delete`, {
          data: [this.user.uid],
        })
        .subscribe({
          next: () => this.router.navigate(['/admin/users']),
          error: () => {
            this.error = this.t('admin.users.errDeleteUser');
            this.cdr.detectChanges();
          },
        }),
    );
  }
}
