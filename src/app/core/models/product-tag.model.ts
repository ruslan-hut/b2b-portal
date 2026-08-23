// ProductTag — short colored badge attached to a product (e.g. "NEW", "IN SEASON").
// Tags are store-scoped; the same tag UID is unique across the system but only ever
// belongs to a single store. Tag text is intentionally not translated — it appears
// identically in every UI language. Color is a free-form hex string ("#RRGGBB").
// sort_order ranks tags against each other in the catalog: products are ordered
// by the minimum sort_order across their assigned tags (untagged products last),
// then by the product's own sort_order. Ordering is computed on the backend.
// A negative sort_order disables ordering for the tag — the badge still renders, but
// the product keeps its common position among untagged products. The admin form
// exposes this as a toggle rather than asking operators to enter a negative number.
export interface ProductTag {
  uid: string;
  store_uid: string;
  name: string;
  color: string;
  sort_order: number;
  last_update?: string;
}
