import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CrmService, CrmAssignableUser } from '../../services/crm.service';
import { CrmTask, CrmTaskStatus, CrmTaskPriority, CrmCreateTaskRequest } from '../../models/crm-task.model';
import { AuthService } from '../../../../core/services/auth.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { formatDateShort } from '../../../../core/utils/date-format';

@Component({
  selector: 'app-task-list',
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListComponent implements OnInit {
  private readonly crmService = inject(CrmService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly orderUid = input<string>('');
  readonly showAddForm = input<boolean>(true);
  readonly taskCreated = output<CrmTask>();
  readonly taskUpdated = output<CrmTask>();

  tasks: CrmTask[] = [];
  loading = false;
  error: string | null = null;

  // Filter
  statusFilter: CrmTaskStatus | 'all' = 'all';

  // New task form
  showNewTaskForm = false;
  newTaskTitle = '';
  newTaskDescription = '';
  newTaskPriority: CrmTaskPriority = 'medium';
  newTaskDueDate = '';
  newTaskAssignee = '';

  // Assignment
  assignableUsers: CrmAssignableUser[] = [];
  currentUserUid = '';

  ngOnInit(): void {
    const currentEntity = this.authService.currentEntityValue;
    if (currentEntity && 'uid' in currentEntity) {
      this.currentUserUid = currentEntity.uid;
    }

    this.loadAssignableUsers();

    if (this.orderUid()) {
      this.loadTasks();
    }
  }

  loadAssignableUsers(): void {
    this.crmService.getAssignableUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: users => {
          this.assignableUsers = users;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to load assignable users:', err);
        }
      });
  }

  loadTasks(): void {
    const orderUid = this.orderUid();
    if (!orderUid) return;

    this.loading = true;
    this.error = null;

    this.crmService.getTasksByOrder(orderUid, 1, 100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.tasks = response.tasks;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to load tasks:', err);
          this.error = 'Failed to load tasks';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  get filteredTasks(): CrmTask[] {
    if (this.statusFilter === 'all') {
      return this.tasks;
    }
    return this.tasks.filter(t => t.status === this.statusFilter);
  }

  toggleNewTaskForm(): void {
    this.showNewTaskForm = !this.showNewTaskForm;
    if (!this.showNewTaskForm) {
      this.resetNewTaskForm();
    }
    this.cdr.markForCheck();
  }

  resetNewTaskForm(): void {
    this.newTaskTitle = '';
    this.newTaskDescription = '';
    this.newTaskPriority = 'medium';
    this.newTaskDueDate = '';
    this.newTaskAssignee = '';
  }

  createTask(): void {
    const orderUid = this.orderUid();
    if (!this.newTaskTitle.trim() || !orderUid) return;

    let dueDate: string | undefined;
    if (this.newTaskDueDate) {
      dueDate = new Date(this.newTaskDueDate).toISOString();
    }

    const request: CrmCreateTaskRequest = {
      order_uid: orderUid,
      title: this.newTaskTitle.trim(),
      description: this.newTaskDescription.trim() || undefined,
      priority: this.newTaskPriority,
      due_date: dueDate,
      assigned_to_uid: this.newTaskAssignee || undefined
    };

    this.crmService.createTask(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showNewTaskForm = false;
          this.resetNewTaskForm();
          this.loadTasks();
        },
        error: err => {
          console.error('Failed to create task:', err);
          this.error = 'Failed to create task';
          this.cdr.markForCheck();
        }
      });
  }

  updateTaskStatus(task: CrmTask, status: CrmTaskStatus): void {
    this.crmService.updateTaskStatus(task.uid, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          task.status = status;
          if (status === 'completed') {
            task.completed_at = new Date().toISOString();
          }
          this.taskUpdated.emit(task);
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to update task status:', err);
          this.cdr.markForCheck();
        }
      });
  }

  completeTask(task: CrmTask): void {
    this.updateTaskStatus(task, 'completed');
  }

  async deleteTask(task: CrmTask): Promise<void> {
    if (!await this.confirmDialog.ask({ message: 'Are you sure you want to delete this task?', danger: true })) return;

    this.crmService.deleteTask(task.uid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.tasks = this.tasks.filter(t => t.uid !== task.uid);
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to delete task:', err);
          this.cdr.markForCheck();
        }
      });
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
    return formatDateShort(dateString);
  }

  formatDueDate(dateString: string | undefined): string {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) {
      return `${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} overdue`;
    } else if (days === 0) {
      return 'Due today';
    } else if (days === 1) {
      return 'Due tomorrow';
    } else {
      return `Due in ${days} days`;
    }
  }

  isAssignedToMe(task: CrmTask): boolean {
    return task.assigned_to_uid === this.currentUserUid;
  }

  assignToMe(task: CrmTask): void {
    this.reassignTask(task, this.currentUserUid);
  }

  reassignTask(task: CrmTask, userUid: string): void {
    const assignedToUid = userUid || undefined;

    this.crmService.updateTask(task.uid, { assigned_to_uid: assignedToUid })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          task.assigned_to_uid = userUid || undefined;
          const user = this.assignableUsers.find(u => u.uid === userUid);
          task.assigned_to_name = user ? `${user.first_name} ${user.last_name}` : undefined;
          this.taskUpdated.emit(task);
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to reassign task:', err);
        }
      });
  }
}
