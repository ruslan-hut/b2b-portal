export type CrmTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type CrmTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface CrmTask {
  uid: string;
  order_uid: string;
  assigned_to_uid?: string;
  assigned_to_name?: string;
  created_by_uid?: string;
  created_by_name?: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: CrmTaskPriority;
  status: CrmTaskStatus;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface CrmCreateTaskRequest {
  order_uid: string;
  assigned_to_uid?: string;
  title: string;
  description?: string;
  due_date?: string;
  priority?: CrmTaskPriority;
}

export interface CrmUpdateTaskRequest {
  title?: string;
  description?: string;
  assigned_to_uid?: string;
  due_date?: string;
  priority?: CrmTaskPriority;
  status?: CrmTaskStatus;
}

export interface CrmUpdateTaskStatusRequest {
  status: CrmTaskStatus;
}

export interface CrmTaskListResponse {
  tasks: CrmTask[];
  total: number;
}
