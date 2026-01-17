import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CrmService } from '../../services/crm.service';
import { CrmActivity, CrmActivityType, CrmCreateActivityRequest, CrmStageChangeMetadata, CrmAssignmentMetadata } from '../../models/crm-activity.model';

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
      'status_change': 'published_with_changes'
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
      'status_change': 'Status Changed'
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
      'status_change': '#ec4899'
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

  canDelete(activity: CrmActivity): boolean {
    // Only allow deleting notes and comments
    return activity.activity_type === 'note' || activity.activity_type === 'comment';
  }

  get hasMoreActivities(): boolean {
    return this.activities.length < this.totalActivities;
  }
}
