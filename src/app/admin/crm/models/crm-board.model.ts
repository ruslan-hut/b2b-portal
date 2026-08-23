import { CrmStage } from './crm-stage.model';
import { CrmOrderAssignment } from './crm-assignment.model';

// Order data as returned by backend (nested in CrmBoardOrderRaw)
export interface CrmOrderData {
  uid: string;
  number?: string;
  client_uid: string;
  store_uid: string;
  status: string;
  total: number;
  currency_code: string;
  created_at: string;
  last_update?: string;
  is_edited?: boolean;
  discount_override?: boolean;
  // ERP-assigned company the order belongs to (GUID + display name).
  company_uid?: string;
  company_name?: string;
  // Document number the ERP assigns once it has processed the order. ERP-owned
  // and read-only — nothing in the CRM writes it back.
  erp_number?: string;
}

// Client data as returned by backend
export interface CrmClientData {
  uid: string;
  name: string;
  email?: string;
}

// Raw board order from backend (nested structure)
export interface CrmBoardOrderRaw {
  order: CrmOrderData;
  assignment?: CrmOrderAssignment;
  client?: CrmClientData;
  entered_at: string;
}

// Flattened order for component use
export interface CrmBoardOrder {
  uid: string;
  number?: string;
  client_uid: string;
  client_name?: string;
  store_uid: string;
  status: string;
  total: number;
  currency_code: string;
  created_at: string;
  last_update?: string;
  assigned_user_uid?: string;
  assigned_user_name?: string;
  is_edited?: boolean;
  discount_override?: boolean;
  company_name?: string;
  erp_number?: string;
}

// Raw column from backend
export interface CrmBoardColumnRaw {
  stage: CrmStage;
  orders: CrmBoardOrderRaw[];
  count: number;
}

// Flattened column for component use
export interface CrmBoardColumn {
  stage: CrmStage;
  orders: CrmBoardOrder[];
  total_count: number;
}

// Raw response from backend
export interface CrmBoardResponseRaw {
  columns: CrmBoardColumnRaw[];
}

export interface CrmBoardResponse {
  columns: CrmBoardColumn[];
}

export interface CrmOrderPipeline {
  order_uid: string;
  stage_uid: string;
  entered_at: string;
  last_update?: string;
}

export interface CrmMoveOrderRequest {
  order_uid: string;
  stage_uid: string;
}
