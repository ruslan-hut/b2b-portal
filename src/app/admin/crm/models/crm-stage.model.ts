export interface CrmStage {
  uid: string;
  name: string;
  color: string;
  sort_order: number;
  is_initial: boolean;
  is_final: boolean;
  store_uid?: string;
  active: boolean;
  created_at?: string;
  last_update?: string;
}

export interface CrmTransition {
  from_stage_uid: string;
  to_stage_uid: string;
  created_at?: string;
}

export interface CrmStageReorderRequest {
  uid: string;
  sort_order: number;
}
