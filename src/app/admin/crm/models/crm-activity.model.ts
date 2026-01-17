export type CrmActivityType =
  | 'note'
  | 'comment'
  | 'stage_change'
  | 'assignment'
  | 'unassignment'
  | 'order_created'
  | 'status_change';

export interface CrmActivity {
  uid: string;
  order_uid: string;
  user_uid?: string;
  user_name?: string;
  activity_type: CrmActivityType;
  content?: string;
  is_internal: boolean;
  metadata?: CrmStageChangeMetadata | CrmAssignmentMetadata;
  created_at: string;
}

export interface CrmStageChangeMetadata {
  from_stage_uid?: string;
  from_stage_name?: string;
  to_stage_uid: string;
  to_stage_name?: string;
}

export interface CrmAssignmentMetadata {
  assigned_to_uid?: string;
  assigned_to_name?: string;
  assigned_by_uid?: string;
  assigned_by_name?: string;
  previous_user_uid?: string;
  previous_user_name?: string;
}

export interface CrmCreateActivityRequest {
  order_uid: string;
  activity_type: CrmActivityType;
  content?: string;
  is_internal?: boolean;
}

export interface CrmActivityTimelineResponse {
  activities: CrmActivity[];
  total: number;
}
