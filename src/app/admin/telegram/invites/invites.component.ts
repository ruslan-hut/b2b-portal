import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface TelegramInvite {
  uid: string;
  code: string;
  status: 'available' | 'used' | 'expired' | 'revoked';
  used_by?: number;
  used_by_username?: string;
  created_at: string;
  expires_at?: string;
}

interface InvitesResponse {
  data: TelegramInvite[];
  pagination: {
    page: number;
    count: number;
    total: number;
    total_pages: number;
  };
}

@Component({
  selector: 'app-invites',
  templateUrl: './invites.component.html',
  styleUrls: ['./invites.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvitesComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private apiUrl = environment.apiUrl;

  items: TelegramInvite[] = [];

  loading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;

  // Generate modal
  showGenerateModal = false;
  generateForm: FormGroup;
  generating = false;

  // Copy feedback
  copiedCode: string | null = null;

  // Expanded items for mobile view
  expandedItems = new Set<string>();

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.generateForm = this.fb.group({
      count: [1, [Validators.required, Validators.min(1), Validators.max(100)]],
      expires_at: ['']
    });
  }

  ngOnInit(): void {
    this.loadInvites();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadInvites(): void {
    this.loading = true;
    this.error = null;

    const url = `${this.apiUrl}/admin/telegram/invites?page=${this.currentPage}&count=${this.pageSize}`;

    this.subscriptions.add(
      this.http.get<InvitesResponse>(url).subscribe({
        next: (response) => {
          this.items = response.data || [];
          this.total = response.pagination?.total || this.items.length;
          this.totalPages = response.pagination?.total_pages || 1;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load invites:', err);
          this.error = 'Failed to load invites';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  // Generate modal
  openGenerateModal(): void {
    this.generateForm.reset({ count: 1, expires_at: '' });
    this.showGenerateModal = true;
    this.cdr.detectChanges();
  }

  closeGenerateModal(): void {
    this.showGenerateModal = false;
    this.cdr.detectChanges();
  }

  generateInvites(): void {
    if (this.generateForm.invalid) return;

    this.generating = true;
    const formValue = this.generateForm.value;

    const data: any = {
      count: formValue.count
    };

    if (formValue.expires_at) {
      data.expires_at = new Date(formValue.expires_at).toISOString();
    }

    this.subscriptions.add(
      this.http.post(`${this.apiUrl}/admin/telegram/invites`, { data }).subscribe({
        next: () => {
          this.generating = false;
          this.closeGenerateModal();
          this.loadInvites();
        },
        error: (err) => {
          console.error('Failed to generate invites:', err);
          this.error = 'Failed to generate invites';
          this.generating = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  // Revoke
  revokeInvite(item: TelegramInvite): void {
    if (!confirm(`Are you sure you want to revoke invite code "${item.code}"?`)) {
      return;
    }

    this.subscriptions.add(
      this.http.post(`${this.apiUrl}/admin/telegram/invites/delete`, {
        data: [item.uid]
      }).subscribe({
        next: () => {
          this.loadInvites();
        },
        error: (err) => {
          console.error('Failed to revoke invite:', err);
          this.error = 'Failed to revoke invite';
          this.cdr.detectChanges();
        }
      })
    );
  }

  // Copy to clipboard
  copyCode(code: string, event: Event): void {
    event.stopPropagation();
    navigator.clipboard.writeText(code).then(() => {
      this.copiedCode = code;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.copiedCode = null;
        this.cdr.detectChanges();
      }, 1500);
    });
  }

  isCopied(code: string): boolean {
    return this.copiedCode === code;
  }

  // Expand/collapse for mobile
  toggleExpanded(uid: string): void {
    if (this.expandedItems.has(uid)) {
      this.expandedItems.delete(uid);
    } else {
      this.expandedItems.add(uid);
    }
    this.cdr.detectChanges();
  }

  isExpanded(uid: string): boolean {
    return this.expandedItems.has(uid);
  }

  // Pagination
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadInvites();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(this.totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Helpers
  getStatusClass(status: string): string {
    switch (status) {
      case 'available':
        return 'status-available';
      case 'used':
        return 'status-used';
      case 'expired':
        return 'status-expired';
      case 'revoked':
        return 'status-revoked';
      default:
        return '';
    }
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  }

  getUsedBy(item: TelegramInvite): string {
    if (!item.used_by) return '-';
    if (item.used_by_username) {
      return `@${item.used_by_username}`;
    }
    return `User ${item.used_by}`;
  }

  refresh(): void {
    this.loadInvites();
  }
}
