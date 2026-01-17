import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CrmService, CrmAssignableUser } from '../../services/crm.service';
import { CrmTask, CrmTaskStatus, CrmTaskPriority } from '../../models/crm-task.model';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
    selector: 'app-my-tasks',
    templateUrl: './my-tasks.component.html',
    styleUrls: ['./my-tasks.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyTasksComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  tasks: CrmTask[] = [];
  loading = false;
  error: string | null = null;
  total = 0;
  page = 1;
  pageSize = 50;

  // Filters
  statusFilter: CrmTaskStatus | 'all' = 'all';
  showOverdueOnly = false;

  // Assignment
  assignableUsers: CrmAssignableUser[] = [];
  currentUserUid = '';

  // Cached grouped tasks
  groupedTasksCache: { title: string; tasks: CrmTask[] }[] = [];

  constructor(
    private crmService: CrmService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Get current user UID
    const currentEntity = this.authService.currentEntityValue;
    if (currentEntity && 'uid' in currentEntity) {
      this.currentUserUid = currentEntity.uid;
    }

    this.loadAssignableUsers();
    this.loadTasks();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadAssignableUsers(): void {
    this.subscriptions.add(
      this.crmService.getAssignableUsers().subscribe({
        next: (users) => {
          this.assignableUsers = users;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load assignable users:', err);
        }
      })
    );
  }

  loadTasks(): void {
    this.loading = true;
    this.error = null;

    const request = this.showOverdueOnly
      ? this.crmService.getOverdueTasks(this.page, this.pageSize)
      : this.crmService.getMyTasks(this.page, this.pageSize);

    this.subscriptions.add(
      request.subscribe({
        next: (response) => {
          this.tasks = response.tasks;
          this.total = response.total;
          this.loading = false;
          this.updateGroupedTasks();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load tasks:', err);
          this.error = 'Failed to load tasks';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  get filteredTasks(): CrmTask[] {
    if (this.statusFilter === 'all') {
      return this.tasks;
    }
    return this.tasks.filter(t => t.status === this.statusFilter);
  }

  updateGroupedTasks(): void {
    const groups: { title: string; tasks: CrmTask[] }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const overdue: CrmTask[] = [];
    const todayTasks: CrmTask[] = [];
    const tomorrowTasks: CrmTask[] = [];
    const thisWeek: CrmTask[] = [];
    const later: CrmTask[] = [];
    const noDueDate: CrmTask[] = [];

    for (const task of this.filteredTasks) {
      if (!task.due_date) {
        noDueDate.push(task);
        continue;
      }

      const dueDate = new Date(task.due_date);

      if (task.status !== 'completed' && task.status !== 'cancelled' && dueDate < today) {
        overdue.push(task);
      } else if (dueDate >= today && dueDate < tomorrow) {
        todayTasks.push(task);
      } else if (dueDate >= tomorrow && dueDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)) {
        tomorrowTasks.push(task);
      } else if (dueDate >= tomorrow && dueDate < nextWeek) {
        thisWeek.push(task);
      } else {
        later.push(task);
      }
    }

    if (overdue.length > 0) groups.push({ title: 'Overdue', tasks: overdue });
    if (todayTasks.length > 0) groups.push({ title: 'Today', tasks: todayTasks });
    if (tomorrowTasks.length > 0) groups.push({ title: 'Tomorrow', tasks: tomorrowTasks });
    if (thisWeek.length > 0) groups.push({ title: 'This Week', tasks: thisWeek });
    if (later.length > 0) groups.push({ title: 'Later', tasks: later });
    if (noDueDate.length > 0) groups.push({ title: 'No Due Date', tasks: noDueDate });

    this.groupedTasksCache = groups;
  }

  onFilterChange(): void {
    this.updateGroupedTasks();
    this.cdr.detectChanges();
  }

  toggleOverdueOnly(): void {
    this.showOverdueOnly = !this.showOverdueOnly;
    this.page = 1;
    this.loadTasks();
  }

  updateTaskStatus(task: CrmTask, status: CrmTaskStatus): void {
    this.subscriptions.add(
      this.crmService.updateTaskStatus(task.uid, status).subscribe({
        next: () => {
          task.status = status;
          if (status === 'completed') {
            task.completed_at = new Date().toISOString();
          }
          this.updateGroupedTasks();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to update task status:', err);
        }
      })
    );
  }

  completeTask(task: CrmTask): void {
    this.updateTaskStatus(task, 'completed');
  }

  goToOrder(task: CrmTask): void {
    this.router.navigate(['/admin/orders', task.order_uid]);
  }

  goToCrmBoard(): void {
    this.router.navigate(['/admin/crm']);
  }

  getPriorityClass(priority: CrmTaskPriority): string {
    return `priority-${priority}`;
  }

  getStatusClass(status: CrmTaskStatus): string {
    return `status-${status}`;
  }

  isOverdue(task: CrmTask): boolean {
    if (!task.due_date || task.status === 'completed' || task.status === 'cancelled') {
      return false;
    }
    return new Date(task.due_date) < new Date();
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDueDate(dateString: string | undefined): string {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  isAssignedToMe(task: CrmTask): boolean {
    return task.assigned_to_uid === this.currentUserUid;
  }

  assignToMe(task: CrmTask): void {
    this.reassignTask(task, this.currentUserUid);
  }

  reassignTask(task: CrmTask, userUid: string): void {
    const assignedToUid = userUid || undefined;

    this.subscriptions.add(
      this.crmService.updateTask(task.uid, { assigned_to_uid: assignedToUid }).subscribe({
        next: () => {
          task.assigned_to_uid = userUid || undefined;
          // Update assigned name from users list
          const user = this.assignableUsers.find(u => u.uid === userUid);
          task.assigned_to_name = user ? `${user.first_name} ${user.last_name}` : undefined;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to reassign task:', err);
        }
      })
    );
  }

  deleteTask(task: CrmTask): void {
    if (!confirm('Are you sure you want to delete this task?')) return;

    this.subscriptions.add(
      this.crmService.deleteTask(task.uid).subscribe({
        next: () => {
          this.tasks = this.tasks.filter(t => t.uid !== task.uid);
          this.updateGroupedTasks();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to delete task:', err);
        }
      })
    );
  }
}
