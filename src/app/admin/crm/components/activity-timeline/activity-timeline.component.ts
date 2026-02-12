import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CrmService } from '../../services/crm.service';
import { CrmActivity, CrmActivityType, CrmCreateActivityRequest, CrmStageChangeMetadata, CrmAssignmentMetadata, CrmOrderFieldChangeMetadata, CrmItemChangeMetadata, CrmTotalChangeMetadata } from '../../models/crm-activity.model';

@Component({
    selector: 'app-activity-timeline',
    templateUrl: './activity-timeline.component.html',
    styleUrls: ['./activity-timeline.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityTimelineComponent implements OnInit, OnDestroy {
  @Input() orderUid!: string;

  private subscriptions = new Subscription();

  activities: CrmActivity[] = [];
  totalActivities = 0;
  loading = false;
  saving = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 20;

  // Add note form
  newNoteContent = '';
  newNoteIsInternal = false;
  showAddNoteForm = false;

  constructor(
    private crmService: CrmService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadActivities();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadActivities(): void {
    if (!this.orderUid) return;

    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.crmService.getActivityTimeline(this.orderUid, this.currentPage, this.pageSize).subscribe({
        next: (response) => {
          this.activities = response.activities;
          this.totalActivities = response.total;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load activities:', err);
          this.error = 'Failed to load activity timeline';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  toggleAddNoteForm(): void {
    this.showAddNoteForm = !this.showAddNoteForm;
    if (!this.showAddNoteForm) {
      this.newNoteContent = '';
      this.newNoteIsInternal = false;
    }
  }

  addNote(): void {
    if (!this.newNoteContent.trim()) {
      this.error = 'Note content cannot be empty';
      return;
    }

    this.saving = true;
    this.error = null;

    const request: CrmCreateActivityRequest = {
      order_uid: this.orderUid,
      activity_type: 'note',
      content: this.newNoteContent.trim(),
      is_internal: this.newNoteIsInternal
    };

    this.subscriptions.add(
      this.crmService.createActivity(request).subscribe({
        next: () => {
          this.newNoteContent = '';
          this.newNoteIsInternal = false;
          this.showAddNoteForm = false;
          this.saving = false;
          // Reload to show new activity
          this.currentPage = 1;
          this.loadActivities();
        },
        error: (err) => {
          console.error('Failed to add note:', err);
          this.error = 'Failed to add note';
          this.saving = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  deleteActivity(uid: string): void {
    if (!confirm('Are you sure you want to delete this activity?')) {
      return;
    }

    this.subscriptions.add(
      this.crmService.deleteActivity(uid).subscribe({
        next: () => {
          this.loadActivities();
        },
        error: (err) => {
          console.error('Failed to delete activity:', err);
          this.error = 'Failed to delete activity';
          this.cdr.detectChanges();
        }
      })
    );
  }

  loadMore(): void {
    if (this.activities.length < this.totalActivities) {
      this.currentPage++;
      this.loading = true;

      this.subscriptions.add(
        this.crmService.getActivityTimeline(this.orderUid, this.currentPage, this.pageSize).subscribe({
          next: (response) => {
            this.activities = [...this.activities, ...response.activities];
            this.loading = false;
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Failed to load more activities:', err);
            this.currentPage--;
            this.loading = false;
            this.cdr.detectChanges();
          }
        })
      );
    }
  }

  getActivityIcon(type: CrmActivityType): string {
    const icons: Record<CrmActivityType, string> = {
      'note': 'note',
      'comment': 'chat',
      'stage_change': 'swap_horiz',
      'assignment': 'person_add',
      'unassignment': 'person_remove',
      'order_created': 'add_shopping_cart',
      'status_change': 'published_with_changes',
      'order_edit': 'edit',
      'items_changed': 'inventory',
      'total_changed': 'payments',
      'discount_changed': 'percent'
    };
    return icons[type] || 'info';
  }

  getActivityTypeLabel(type: CrmActivityType): string {
    const labels: Record<CrmActivityType, string> = {
      'note': 'Note',
      'comment': 'Comment',
      'stage_change': 'Stage Changed',
      'assignment': 'Assigned',
      'unassignment': 'Unassigned',
      'order_created': 'Order Created',
      'status_change': 'Status Changed',
      'order_edit': 'Order Edited',
      'items_changed': 'Items Changed',
      'total_changed': 'Total Changed',
      'discount_changed': 'Discount Changed'
    };
    return labels[type] || type;
  }

  getActivityColor(type: CrmActivityType): string {
    const colors: Record<CrmActivityType, string> = {
      'note': '#6366f1',
      'comment': '#0ea5e9',
      'stage_change': '#8b5cf6',
      'assignment': '#10b981',
      'unassignment': '#f59e0b',
      'order_created': '#22c55e',
      'status_change': '#ec4899',
      'order_edit': '#f97316',
      'items_changed': '#06b6d4',
      'total_changed': '#84cc16',
      'discount_changed': '#a855f7'
    };
    return colors[type] || '#64748b';
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatRelativeTime(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return this.formatDateTime(dateString);
  }

  getStageChangeDescription(activity: CrmActivity): string {
    const metadata = activity.metadata as CrmStageChangeMetadata | undefined;
    if (!metadata) return 'Stage was changed';

    const from = metadata.from_stage_name || 'Unknown';
    const to = metadata.to_stage_name || 'Unknown';
    return `${from} → ${to}`;
  }

  getAssignmentDescription(activity: CrmActivity): string {
    const metadata = activity.metadata as CrmAssignmentMetadata | undefined;
    if (!metadata) return activity.activity_type === 'assignment' ? 'Order assigned' : 'Order unassigned';

    if (activity.activity_type === 'assignment') {
      const assignedTo = metadata.assigned_to_name || metadata.assigned_to_uid || 'Unknown';
      return `Assigned to ${assignedTo}`;
    } else {
      const previousUser = metadata.previous_user_name || metadata.previous_user_uid || 'Unknown';
      return `Unassigned from ${previousUser}`;
    }
  }

  getOrderEditDescription(activity: CrmActivity): string {
    const metadata = activity.metadata as CrmOrderFieldChangeMetadata[] | undefined;
    if (!metadata || !Array.isArray(metadata) || metadata.length === 0) {
      return 'Order fields updated';
    }

    if (metadata.length === 1) {
      const change = metadata[0];
      return this.formatFieldChange(change);
    }

    return `${metadata.length} fields updated: ${metadata.map(c => c.field_name).join(', ')}`;
  }

  getItemsChangedDescription(activity: CrmActivity): string {
    const metadata = activity.metadata as CrmItemChangeMetadata[] | undefined;
    if (!metadata || !Array.isArray(metadata) || metadata.length === 0) {
      return 'Order items changed';
    }

    const added = metadata.filter(m => m.action === 'added').length;
    const removed = metadata.filter(m => m.action === 'removed').length;
    const modified = metadata.filter(m => m.action === 'modified').length;

    const parts: string[] = [];
    if (added > 0) parts.push(`${added} added`);
    if (removed > 0) parts.push(`${removed} removed`);
    if (modified > 0) parts.push(`${modified} modified`);

    return parts.length > 0 ? parts.join(', ') : 'Order items changed';
  }

  getTotalChangedDescription(activity: CrmActivity): string {
    const metadata = activity.metadata as CrmTotalChangeMetadata | undefined;
    if (!metadata) return 'Order total changed';

    const oldTotal = (metadata.old_total / 100).toFixed(2);
    const newTotal = (metadata.new_total / 100).toFixed(2);

    return `Total: $${oldTotal} → $${newTotal}`;
  }

  getItemChangeDetails(changes: CrmItemChangeMetadata[]): string[] {
    return changes.map(change => {
      const productName = change.product_name || change.sku || change.product_uid;
      switch (change.action) {
        case 'added':
          return `+ ${productName} (qty: ${change.new_quantity})`;
        case 'removed':
          return `- ${productName} (qty: ${change.old_quantity})`;
        case 'modified':
          return `✎ ${productName} (qty: ${change.old_quantity} → ${change.new_quantity})`;
        default:
          return productName;
      }
    });
  }

  hasItemChangeDetails(activity: CrmActivity): boolean {
    return activity.metadata != null && Array.isArray(activity.metadata) && activity.metadata.length > 0;
  }

  getItemChangeDetailsArray(activity: CrmActivity): string[] {
    if (!this.hasItemChangeDetails(activity)) {
      return [];
    }
    return this.getItemChangeDetails(activity.metadata as CrmItemChangeMetadata[]);
  }

  private formatFieldChange(change: CrmOrderFieldChangeMetadata): string {
    const fieldName = this.formatFieldName(change.field_name);
    if (!change.old_value || change.old_value === '') {
      return `${fieldName} set to: ${change.new_value}`;
    }
    return `${fieldName}: ${change.old_value} → ${change.new_value}`;
  }

  private formatFieldName(fieldName: string): string {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  canDelete(activity: CrmActivity): boolean {
    // Only allow deleting notes and comments
    return activity.activity_type === 'note' || activity.activity_type === 'comment';
  }

  get hasMoreActivities(): boolean {
    return this.activities.length < this.totalActivities;
  }
}
