export interface CrmStage {
  uid: string;
  name: string;
  color: string;
  sort_order: number;
  is_initial: boolean;
  is_final: boolean;
  allow_edit: boolean;
  allow_create_shipment: boolean; // Allow creating shipments when order is in this stage
  creates_allocation: boolean; // Create allocations when order enters this stage
  deletes_allocation: boolean; // Delete allocations when order enters this stage
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
