import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { CrmBoardOrder } from '../../models/crm-board.model';
import { CrmService } from '../../services/crm.service';

interface User {
  uid: string;
  email: string;
  name?: string;
  role: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Component({
    selector: 'app-assignment-modal',
    templateUrl: './assignment-modal.component.html',
    styleUrls: ['./assignment-modal.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssignmentModalComponent implements OnInit, OnDestroy {
  @Input() order!: CrmBoardOrder;

  @Output() complete = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  private subscriptions = new Subscription();

  users: User[] = [];
  selectedUserUid: string = '';
  loading = false;
  saving = false;
  error: string | null = null;

  constructor(
    private http: HttpClient,
    private crmService: CrmService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    if (this.order.assigned_user_uid) {
      this.selectedUserUid = this.order.assigned_user_uid;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadUsers(): void {
    this.loading = true;
    this.subscriptions.add(
      this.http.get<ApiResponse<User[]>>(`${environment.apiUrl}/admin/user`).subscribe({
        next: (response) => {
          // Filter to only admin and manager roles
          this.users = (response.data || []).filter(
            u => u.role === 'admin' || u.role === 'manager'
          );
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load users:', err);
          this.error = 'Failed to load users';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  onAssign(): void {
    if (!this.selectedUserUid) {
      this.error = 'Please select a user';
      return;
    }

    this.saving = true;
    this.error = null;

    this.subscriptions.add(
      this.crmService.assignOrders({
        user_uid: this.selectedUserUid,
        order_uids: [this.order.uid]
      }).subscribe({
        next: () => {
          this.complete.emit();
        },
        error: (err) => {
          console.error('Failed to assign order:', err);
          this.error = 'Failed to assign order';
          this.saving = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  onUnassign(): void {
    if (!this.order.assigned_user_uid) {
      return;
    }

    this.saving = true;
    this.error = null;

    this.subscriptions.add(
      this.crmService.unassignOrders([this.order.uid]).subscribe({
        next: () => {
          this.complete.emit();
        },
        error: (err) => {
          console.error('Failed to unassign order:', err);
          this.error = 'Failed to unassign order';
          this.saving = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  onCancel(): void {
    this.cancel.emit();
  }

  getUserDisplay(user: User): string {
    return user.name || user.email;
  }
}
