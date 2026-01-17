import { CrmActivity } from './crm-activity.model';

export interface CrmDashboardFilters {
  storeUid?: string;
  dateFrom?: string;
  dateTo?: string;
  assigneeUid?: string;
}

export interface CrmPipelineStageStats {
  stage_uid: string;
  stage_name: string;
  stage_color: string;
  order_count: number;
  total_value: number;
  avg_days_in_stage: number;
}

export interface CrmWorkloadStats {
  user_uid: string;
  user_name: string;
  assigned_orders: number;
  pending_tasks: number;
  overdue_tasks: number;
  completed_today: number;
}

export interface CrmTaskStats {
  total_pending: number;
  total_in_progress: number;
  total_overdue: number;
  completed_today: number;
  completed_week: number;
}

export interface CrmDashboardStats {
  pipeline_stats: CrmPipelineStageStats[];
  workload_stats: CrmWorkloadStats[];
  task_stats: CrmTaskStats;
  recent_activity: CrmActivity[];
}
