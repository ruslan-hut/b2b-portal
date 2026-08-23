export interface CrmStageTranslation {
  stage_uid?: string;
  language: string;
  name: string;
  last_update?: string;
}

/**
 * Coarse, client-visible position in the order lifecycle. The internal pipeline
 * is free-form; clients only ever see one of these, and an empty value keeps a
 * stage internal-only.
 */
export type ClientPhase = '' | 'placed' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

/** The progress track shown to clients. Cancelled ends an order, so it is not on it. */
export const CLIENT_PHASE_FLOW: ClientPhase[] = ['placed', 'confirmed', 'processing', 'shipped', 'delivered'];

/** Every value assignable to a stage, in the order the editor lists them. */
export const CLIENT_PHASE_OPTIONS: ClientPhase[] = ['', ...CLIENT_PHASE_FLOW, 'cancelled'];

export interface CrmStage {
  uid: string;
  name: string;
  color: string;
  sort_order: number;
  is_initial: boolean;
  is_final: boolean;
  allow_edit: boolean;
  allow_create_shipment: boolean; // Allow creating shipments when order is in this stage
  allow_split: boolean; // Allow splitting an order into parts when it is in this stage
  creates_allocation: boolean; // Create allocations when order enters this stage
  deletes_allocation: boolean; // Delete allocations when order enters this stage
  client_phase: ClientPhase; // Client-visible phase this stage maps to; empty = internal-only
  store_uid?: string;
  active: boolean;
  created_at?: string;
  last_update?: string;
  translations?: CrmStageTranslation[]; // Localized stage names per language
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
