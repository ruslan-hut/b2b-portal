import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { CrmService, CrmAssignableUser } from '../../services/crm.service';
import { CrmTask, CrmTaskStatus, CrmTaskPriority, CrmCreateTaskRequest } from '../../models/crm-task.model';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
    selector: 'app-task-list',
    templateUrl: './task-list.component.html',
    styleUrls: ['./task-list.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskListComponent implements OnInit, OnDestroy {
  @Input() orderUid: string = '';
  @Input() showAddForm: boolean = true;
  @Output() taskCreated = new EventEmitter<CrmTask>();
  @Output() taskUpdated = new EventEmitter<CrmTask>();

  private subscriptions = new Subscription();

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

  constructor(
    private crmService: CrmService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Get current user UID
    const currentEntity = this.authService.currentEntityValue;
    if (currentEntity && 'uid' in currentEntity) {
      this.currentUserUid = currentEntity.uid;
    }

    // Load assignable users
    this.loadAssignableUsers();

    if (this.orderUid) {
      this.loadTasks();
    }
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

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadTasks(): void {
    if (!this.orderUid) return;

    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.crmService.getTasksByOrder(this.orderUid, 1, 100).subscribe({
        next: (response) => {
          this.tasks = response.tasks;
          this.loading = false;
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

  toggleNewTaskForm(): void {
    this.showNewTaskForm = !this.showNewTaskForm;
    if (!this.showNewTaskForm) {
      this.resetNewTaskForm();
    }
    this.cdr.detectChanges();
  }

  resetNewTaskForm(): void {
    this.newTaskTitle = '';
    this.newTaskDescription = '';
    this.newTaskPriority = 'medium';
    this.newTaskDueDate = '';
    this.newTaskAssignee = '';
  }

  createTask(): void {
    if (!this.newTaskTitle.trim() || !this.orderUid) return;

    // Convert datetime-local format to ISO format
    let dueDate: string | undefined;
    if (this.newTaskDueDate) {
      dueDate = new Date(this.newTaskDueDate).toISOString();
    }

    const request: CrmCreateTaskRequest = {
      order_uid: this.orderUid,
      title: this.newTaskTitle.trim(),
      description: this.newTaskDescription.trim() || undefined,
      priority: this.newTaskPriority,
      due_date: dueDate,
      assigned_to_uid: this.newTaskAssignee || undefined
    };

    this.subscriptions.add(
      this.crmService.createTask(request).subscribe({
        next: (response) => {
          this.showNewTaskForm = false;
          this.resetNewTaskForm();
          this.loadTasks();
        },
        error: (err) => {
          console.error('Failed to create task:', err);
          this.error = 'Failed to create task';
          this.cdr.detectChanges();
        }
      })
    );
  }

  updateTaskStatus(task: CrmTask, status: CrmTaskStatus): void {
    this.subscriptions.add(
      this.crmService.updateTaskStatus(task.uid, status).subscribe({
        next: () => {
          task.status = status;
          if (status === 'completed') {
            task.completed_at = new Date().toISOString();
          }
          this.taskUpdated.emit(task);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to update task status:', err);
          this.cdr.detectChanges();
        }
      })
    );
  }

  completeTask(task: CrmTask): void {
    this.updateTaskStatus(task, 'completed');
  }

  deleteTask(task: CrmTask): void {
    if (!confirm('Are you sure you want to delete this task?')) return;

    this.subscriptions.add(
      this.crmService.deleteTask(task.uid).subscribe({
        next: () => {
          this.tasks = this.tasks.filter(t => t.uid !== task.uid);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to delete task:', err);
          this.cdr.detectChanges();
        }
      })
    );
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

    this.subscriptions.add(
      this.crmService.updateTask(task.uid, { assigned_to_uid: assignedToUid }).subscribe({
        next: () => {
          task.assigned_to_uid = userUid || undefined;
          // Update assigned name from users list
          const user = this.assignableUsers.find(u => u.uid === userUid);
          task.assigned_to_name = user ? `${user.first_name} ${user.last_name}` : undefined;
          this.taskUpdated.emit(task);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to reassign task:', err);
        }
      })
    );
  }
}
