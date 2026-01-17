export interface CrmOrderAssignment {
  order_uid: string;
  user_uid: string;
  user_name?: string;
  assigned_by_uid?: string;
  assigned_at: string;
  last_update?: string;
}

export interface CrmAssignOrdersRequest {
  user_uid: string;
  order_uids: string[];
}

export interface CrmMyAssignedOrder {
  uid: string;
  number?: string;
  client_uid: string;
  client_name?: string;
  store_uid: string;
  status: string;
  total: number;
  currency_code: string;
  created_at: string;
  stage_uid?: string;
  stage_name?: string;
  assigned_at: string;
}
