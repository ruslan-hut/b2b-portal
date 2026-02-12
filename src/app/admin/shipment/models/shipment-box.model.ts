export interface ShipmentBox {
  uid: string;
  name: string;
  description?: string;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  max_weight_kg?: number;
  active: boolean;
  store_uid?: string;
  created_at: string;
  last_update: string;
}
