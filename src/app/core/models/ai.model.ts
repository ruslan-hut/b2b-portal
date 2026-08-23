/**
 * AI assistant for the Partner Resources editor.
 *
 * Everything here is admin- or editor-facing. Nothing in this file is used on
 * the client side of the portal: partners read text a human approved, and no
 * model output reaches them without an editor accepting it first.
 */

export interface AIModelOption {
  id: string;
  label: string;
}

/**
 * Settings as the admin screen sees them. The API key is never returned —
 * `api_key_masked` is for recognising which key is stored, not for editing.
 */
export interface AISettings {
  id: number;
  enabled: boolean;
  api_key_masked: string;
  has_api_key: boolean;
  model: string;
  monthly_token_cap: number;
  models: AIModelOption[];
  created_at?: string;
  last_update?: string;
}

/**
 * A partial update. `api_key` absent leaves the stored key alone, which is why
 * the form must not send an empty string on an ordinary save.
 */
export interface AISettingsUpdate {
  enabled?: boolean;
  api_key?: string;
  model?: string;
  monthly_token_cap?: number;
}

export interface AITestResult {
  ok: boolean;
  model?: string;
  message?: string;
  latency_ms?: number;
}

/** Why the assistant is unavailable, mapped to a message in the editor. */
export type AIUnavailableReason =
  | 'disabled'
  | 'no_api_key'
  | 'cap_reached'
  | 'no_languages'
  | 'unavailable';

export interface AIAvailability {
  available: boolean;
  reason?: AIUnavailableReason;
  model?: string;
  tokens_used: number;
  monthly_token_cap: number;
}

export interface AIGlossaryTerm {
  uid?: string;
  term: string;
  language?: string;
  translation?: string;
  do_not_translate: boolean;
  notes?: string;
  last_update?: string;
}

export interface AIUsageSummary {
  operation: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

// --- translation ------------------------------------------------------------

export interface AITranslateRequest {
  page_uid: string;
  from: string;
  to: string;
}

export interface AITranslateText {
  source: string;
  proposed: string;
}

/** Warnings the editor renders next to a block instead of hiding the result. */
export type AIBlockWarning =
  | 'html_structure_changed'
  | 'missing_from_response'
  | 'item_count_changed'
  | 'unsafe_html';

export interface AITranslateField {
  key: string;
  source: string;
  proposed: string;
}

export interface AITranslateBlock {
  uid: string;
  block_type: string;
  sort_order: number;
  fields: AITranslateField[];
  /**
   * The complete target-language payload, ready to assign to the block on
   * accept. Built from a copy of the source payload so settings that live in
   * the payload — a heading's level, a callout's tone, a file item's market —
   * survive untouched.
   */
  payload: Record<string, any>;
  warning?: AIBlockWarning;
}

export interface AITranslateProposal {
  page_uid: string;
  from: string;
  to: string;
  title: AITranslateText;
  summary: AITranslateText;
  blocks: AITranslateBlock[];
  refused?: boolean;
  message?: string;
}
