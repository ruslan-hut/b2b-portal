export type CrmActivityType =
  | 'note'
  | 'comment'
  | 'stage_change'
  | 'assignment'
  | 'unassignment'
  | 'order_created'
  | 'status_change'
  | 'order_edit'
  | 'items_changed'
  | 'total_changed'
  | 'discount_changed';

export interface CrmActivity {
  uid: string;
  order_uid: string;
  user_uid?: string;
  user_name?: string;
  activity_type: CrmActivityType;
  content?: string;
  is_internal: boolean;
  metadata?:
    | CrmStageChangeMetadata
    | CrmAssignmentMetadata
    | CrmOrderFieldChangeMetadata[]
    | CrmItemChangeMetadata[]
    | CrmTotalChangeMetadata;
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

export interface CrmOrderFieldChangeMetadata {
  field_name: string;
  old_value?: any;
  new_value: any;
}

export interface CrmItemChangeMetadata {
  action: 'added' | 'removed' | 'modified';
  product_uid: string;
  product_name?: string;
  sku?: string;
  old_quantity?: number;
  new_quantity?: number;
}

export interface CrmTotalChangeMetadata {
  old_total: number;
  new_total: number;
  old_subtotal?: number;
  new_subtotal?: number;
  old_vat?: number;
  new_vat?: number;
  item_count: number;
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
