/**
 * Partner Resources content model.
 *
 * Mirrors backend/entity/content_page.go and content_block.go. Blocks are
 * embedded in the page payload because a page edit is one transaction on the
 * server — there is no separate block endpoint.
 */

/** Publication state. `scheduled` joins the enum in Phase 3. */
export type ContentStatus = 'draft' | 'published' | 'archived';

/** Controls how a page's *children* are rendered, not the page itself. */
export type ContentLayout = 'article' | 'hub' | 'library';

/** The Phase 1 block palette. Phase 2 adds gallery, accordion, video, columns, table. */
export type BlockType =
  | 'heading'
  | 'text'
  | 'callout'
  | 'files'
  | 'image'
  | 'link_cards'
  | 'divider';

/**
 * How a `link_cards` block draws its items — `settings.display`.
 *
 * `list` is the icon+title row the block shipped with. `cover` is picture-led:
 * the image is the card and the title is its caption, which is how a category
 * index is actually scanned. Mirrors entity.LinkCardsSettings.
 */
export type LinkCardsDisplay = 'list' | 'cover';

export interface ContentPageTranslation {
  page_uid?: string;
  language: string;
  title: string;
  summary?: string;
}

export interface ContentBlockTranslation {
  block_uid?: string;
  language: string;
  payload: Record<string, any>;
}

export interface ContentBlock {
  uid?: string;
  page_uid?: string;
  block_type: BlockType;
  sort_order: number;
  /** Language-neutral settings (which file, how many columns). */
  settings?: Record<string, any>;
  /** Per-language content. Empty for blocks carrying no text. */
  payloads?: ContentBlockTranslation[];
  /** Resolved payload for the requested language, read-only. */
  payload?: Record<string, any>;
}

export interface ContentPage {
  uid: string;
  parent_uid?: string;
  /** Unique within the parent, not across the tree. Use `path` to address a page. */
  slug: string;
  /**
   * Slash-joined slug chain from the root ("legal/certificates"), computed by
   * the backend on read. Every partner-facing link is built from this.
   */
  path?: string;
  sort_order: number;
  layout: ContentLayout;
  /** A name from the <app-icon> registry, never an emoji (DESIGN_POLICY §11). */
  icon?: string;
  cover_file_uid?: string;
  status: ContentStatus;
  /** Empty means visible in every store. */
  store_uid?: string;
  staff_only: boolean;

  published_at?: string;
  publish_at?: string;
  unpublish_at?: string;
  created_at?: string;
  last_update?: string;

  translations?: ContentPageTranslation[];
  blocks?: ContentBlock[];

  /** Audience scope. Empty means unrestricted on that dimension. */
  languages?: string[];
  countries?: string[];

  // --- read-only, resolved by the server ---
  title?: string;
  summary?: string;
  /**
   * Which translation was actually used. Lets the UI say "shown in English, no
   * Polish version yet" rather than silently substituting.
   */
  resolved_language?: string;
  /** Whether to render the staff bar. Comes from the API, not from the role. */
  can_edit?: boolean;
  children?: ContentPage[];
  /**
   * Metadata for every media file the blocks reference, so a document row can
   * be drawn without a request per file. Single-page reads only.
   */
  files?: ContentFileRef[];
}

/** Partner-facing view of a media file. */
export interface ContentFileRef {
  uid: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  language?: string;
  /** The date the document itself carries, not the upload date. */
  revision_date?: string;
  /** UID of the file that replaces this one; absent means current. */
  superseded_by?: string;
}

export interface ContentLanguage {
  code: string;
  /** Native display name: "Українська", "Polski". */
  name: string;
  sort_order: number;
  active: boolean;
}

export interface ContentPageReorder {
  uid: string;
  parent_uid?: string;
  sort_order: number;
}

export interface ContentPagePublish {
  uid: string;
  status: ContentStatus;
}

/** How many clients an audience scope currently reaches. */
export interface AudienceReach {
  reached: number;
  without_address: number;
}

/** A tree node flattened for the admin table, carrying its indent depth. */
export interface FlatPageNode {
  page: ContentPage;
  depth: number;
}

/** Blocks that store translatable text. Mirrors entity.BlockCarriesText. */
const BLOCKS_WITH_TEXT: ReadonlySet<string> = new Set([
  'heading',
  'text',
  'callout',
  'link_cards',
  'files',
  // `image` belongs here for the same reason it does on the server: its caption
  // is per-language prose. Left out, "copy from language" silently skipped it.
  'image'
]);

export function blockCarriesText(type: BlockType): boolean {
  return BLOCKS_WITH_TEXT.has(type);
}

/** Icon shown for each block type in the editor's block list. */
export const BLOCK_ICONS: Record<BlockType, string> = {
  heading: 'title',
  text: 'notes',
  callout: 'campaign',
  files: 'attach_file',
  image: 'image',
  link_cards: 'grid_view',
  divider: 'horizontal_rule'
};

// --- import (Notion migration) ---------------------------------------------

/** Codes for what an import could not finish. Nothing here blocks the import. */
export type ContentImportWarningCode =
  | 'file_not_in_library'
  | 'page_link_needs_target'
  | 'image_needs_upload';

export interface ContentImportWarning {
  code: ContentImportWarningCode;
  detail: string;
}

export interface ContentImportRequest {
  source: string;
  /** auto sniffs the paste; the editor sends auto unless told otherwise. */
  format?: 'auto' | 'html' | 'markdown';
  language: string;
}

/**
 * An import proposal. Nothing is written server-side — the editor appends or
 * replaces locally and the page's ordinary save persists it.
 */
export interface ContentImportResult {
  title: string;
  blocks: ContentBlock[];
  /**
   * Document references resolved against the media library. Together these
   * answer the question that decides whether an import is usable: were the
   * files uploaded before the paste.
   */
  files_matched: number;
  files_missing: number;
  warnings: ContentImportWarning[];
}
