/**
 * The project's icon set — inline SVG geometry, one entry per name.
 *
 * Why a registry and not a font: Material Icons arrived from a Google Fonts
 * CDN as a ligature webfont, so every icon in the app was a third-party
 * request that rendered the literal word ("filter_list", "local_shipping")
 * until it landed, could not be recoloured per path, and could not ship
 * offline. These are paths in the bundle: no request, no FOUT, `currentColor`
 * throughout, and the same glyph on every platform — which emoji, the other
 * thing this replaces, never were.
 *
 * **The keys are the Material Icons names.** Not because Material is special,
 * but because icon names in this product are *data*: a content page's `icon`
 * column, a chat platform's `icon`, the editor's icon picker. Renaming the
 * keys would have meant a data migration for a cosmetic gain, and would have
 * left every stored value pointing at nothing.
 *
 * Drawing rules for new entries, so the set stays one set:
 * - 24×24 viewBox, geometry inset to a 20×20 live area (2px padding).
 * - Stroked, never filled, unless `filled` says otherwise. Stroke width, caps
 *   and joins come from the component, not the path.
 * - A new icon with no Material counterpart is named for what it means here.
 */
export interface IconDef {
  paths: string[];
  /** Fill the paths with currentColor instead of stroking them. */
  filled?: boolean;
}

/* Shapes reused across several icons, so a circle is the same circle
   everywhere and a document is the same document. */
const CIRCLE = 'M21.25 12a9.25 9.25 0 1 1-18.5 0 9.25 9.25 0 0 1 18.5 0z';
const TRIANGLE = 'M13.3 4.6a1.5 1.5 0 0 0-2.6 0L2.9 18.4a1.5 1.5 0 0 0 1.3 2.25h15.6a1.5 1.5 0 0 0 1.3-2.25z';
const DOC = 'M5.75 3.75h8.5L19 8.5v11.75H5.75z';
const DOC_FOLD = 'M14.25 3.75V8.5H19';
const BANG_TOP = 'M12 8.5v4.5';
const BANG_DOT = 'M12 16.4v.01';
const CLIP_BODY = 'M6.75 5.75h10.5v14.5H6.75z';
const CLIP_TAB = 'M9.75 3.75h4.5v3h-4.5z';
const HEAD = 'M12 3.75a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z';
const SHOULDERS = 'M4.75 20.25a7.25 7.25 0 0 1 14.5 0';
const SCREEN = 'M3.75 4.75h16.5v11.5H3.75z';
const EYE = 'M2.75 12S6.5 5.75 12 5.75 21.25 12 21.25 12 17.5 18.25 12 18.25 2.75 12 2.75 12z';
const SLASH = 'm4.25 4.25 15.5 15.5';
const TRASH_LID = 'M3.75 6.5h16.5';
const TRASH_CAN = 'M6.25 6.5h11.5v13a1.5 1.5 0 0 1-1.5 1.5h-8.5a1.5 1.5 0 0 1-1.5-1.5z';
const TRASH_HANDLE = 'M9.25 6.5V4.75a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1V6.5';
const CART = 'M2.75 4.25h2.5l2.4 10.4h9.6l2.25-7.65H6.1';
const CART_WHEELS = 'M9.5 18.75v.01M16.5 18.75v.01';
const GEAR_TEETH =
  'M12 3.25 13.4 5.6l2.7-.55.9 2.6 2.4 1.35-.75 2.65.75 2.65-2.4 1.35-.9 2.6-2.7-.55L12 20.75l-1.4-2.35-2.7.55-.9-2.6-2.4-1.35.75-2.65-.75-2.65 2.4-1.35.9-2.6 2.7.55z';
const BUBBLE = 'M4.75 5.75h14.5v10h-9l-5.5 4.25v-4.25h0z';

export const ICONS: Record<string, IconDef> = {
  /* ---------- arrows, chevrons, navigation ---------- */
  close: { paths: ['m6 6 12 12', 'm18 6-12 12'] },
  add: { paths: ['M12 4.75v14.5', 'M4.75 12h14.5'] },
  remove: { paths: ['M4.75 12h14.5'] },
  menu: { paths: ['M4 7h16', 'M4 12h16', 'M4 17h16'] },
  chevron_left: { paths: ['m14.5 6.25-5.75 5.75 5.75 5.75'] },
  chevron_right: { paths: ['m9.5 6.25 5.75 5.75-5.75 5.75'] },
  expand_more: { paths: ['m6.25 9.5 5.75 5.75 5.75-5.75'] },
  expand_less: { paths: ['m6.25 14.5 5.75-5.75 5.75 5.75'] },
  keyboard_arrow_down: { paths: ['m6.25 9.5 5.75 5.75 5.75-5.75'] },
  keyboard_arrow_up: { paths: ['m6.25 14.5 5.75-5.75 5.75 5.75'] },
  arrow_back: { paths: ['M19.25 12H4.75', 'm10.5 6.25-5.75 5.75 5.75 5.75'] },
  arrow_forward: { paths: ['M4.75 12h14.5', 'm13.5 6.25 5.75 5.75-5.75 5.75'] },
  arrow_upward: { paths: ['M12 19.25V4.75', 'm6.25 10.5 5.75-5.75 5.75 5.75'] },
  arrow_downward: { paths: ['M12 4.75v14.5', 'm6.25 13.5 5.75 5.75 5.75-5.75'] },
  subdirectory_arrow_right: { paths: ['M5.75 4.25v9.5a2 2 0 0 0 2 2h10.5', 'm14.75 12.25 3.5 3.5-3.5 3.5'] },
  call_split: { paths: ['M12 20.25v-5.75', 'm12 14.5-4.25-4.25V5.75', 'm5.25 8.25 2.5-2.5 2.5 2.5', 'm12 14.5 4.25-4.25V5.75', 'm13.75 8.25 2.5-2.5 2.5 2.5'] },
  open_in_new: { paths: ['M13.25 4.75h6v6', 'M19.25 4.75 11 13', 'M17.5 14v4.25a1.5 1.5 0 0 1-1.5 1.5H5.75a1.5 1.5 0 0 1-1.5-1.5V8a1.5 1.5 0 0 1 1.5-1.5H10'] },
  link: { paths: ['M10 13.75a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1.4 1.4', 'M14 10.25a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1.4-1.4'] },
  logout: { paths: ['M9.75 4.75H5.5a1.5 1.5 0 0 0-1.5 1.5v11.5a1.5 1.5 0 0 0 1.5 1.5h4.25', 'M15 8.25 18.75 12 15 15.75', 'M18.75 12H9.5'] },
  drag_indicator: {
    paths: [
      'M9.5 5.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z',
      'M14.5 5.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z',
      'M9.5 10.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z',
      'M14.5 10.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z',
      'M9.5 16.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z',
      'M14.5 16.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z',
    ],
    filled: true,
  },

  /* ---------- state ---------- */
  check: { paths: ['m5 12.5 4.75 4.75L19 7.75'] },
  done_all: { paths: ['m2.5 12.75 4 4L14 9.25', 'm11.5 16.75 1.25 1.25L21.5 9.25'] },
  check_circle: { paths: [CIRCLE, 'm8 12.25 2.75 2.75L16.25 9.5'] },
  task_alt: { paths: ['M20.9 10.6a9.25 9.25 0 1 1-4.9-6.35', 'm8 11.75 2.75 2.75L20.75 4.5'] },
  cancel: { paths: [CIRCLE, 'm8.75 8.75 6.5 6.5', 'm15.25 8.75-6.5 6.5'] },
  error: { paths: [CIRCLE, 'M12 7.25v5.5', 'M12 16.4v.01'] },
  error_outline: { paths: [CIRCLE, 'M12 7.25v5.5', 'M12 16.4v.01'] },
  info: { paths: [CIRCLE, 'M12 11v5.5', 'M12 7.6v.01'] },
  info_outline: { paths: [CIRCLE, 'M12 11v5.5', 'M12 7.6v.01'] },
  warning: { paths: [TRIANGLE, BANG_TOP, BANG_DOT] },
  warning_amber: { paths: [TRIANGLE, BANG_TOP, BANG_DOT] },
  report_problem: { paths: [TRIANGLE, BANG_TOP, BANG_DOT] },
  block: { paths: [CIRCLE, 'm5.9 5.9 12.2 12.2'] },
  do_not_disturb_on: { paths: [CIRCLE, 'M7.75 12h8.5'] },
  verified: {
    paths: [
      'M12 2.75 14.6 5.4l3.7-.35-.35 3.7L20.6 12l-2.65 2.6.35 3.7-3.7-.35L12 20.6l-2.6-2.65-3.7.35.35-3.7L3.4 12l2.65-2.6-.35-3.7 3.7.35z',
      'm8.75 12.25 2.25 2.25 4.25-4.75',
    ],
  },
  workspace_premium: {
    paths: ['M12 3.25a5.75 5.75 0 1 1 0 11.5 5.75 5.75 0 0 1 0-11.5z', 'm8.5 14.25-1.75 6 5.25-2.5 5.25 2.5-1.75-6'],
  },
  star: { paths: ['m12 3.5 2.75 5.65 6.25.9-4.5 4.4 1.05 6.2L12 17.7l-5.55 2.95L7.5 14.45 3 10.05l6.25-.9z'], filled: true },
  star_outline: { paths: ['m12 3.5 2.75 5.65 6.25.9-4.5 4.4 1.05 6.2L12 17.7l-5.55 2.95L7.5 14.45 3 10.05l6.25-.9z'] },
  pause: { paths: ['M9.25 5.25v13.5', 'M14.75 5.25v13.5'] },
  play_arrow: { paths: ['M7.75 4.9 19 12 7.75 19.1z'], filled: true },
  lock: { paths: ['M5.75 10.5h12.5v9.75H5.75z', 'M8.5 10.5V7.75a3.5 3.5 0 0 1 7 0v2.75'] },
  visibility: { paths: [EYE, 'M12 9.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5z'] },
  visibility_off: { paths: ['M6.5 6.9C4.15 8.5 2.75 12 2.75 12s3.75 6.25 9.25 6.25c1.9 0 3.5-.75 4.8-1.7', 'M9.9 6.15A8.4 8.4 0 0 1 12 5.75c5.5 0 9.25 6.25 9.25 6.25s-.95 1.6-2.6 3.15', SLASH] },
  vpn_key: { paths: ['M14.25 8.5a4.25 4.25 0 1 0-3.6 4.2L12.5 14.5h2.25V17h2.5v2.5h3.5v-3.75l-6-6a4.2 4.2 0 0 0 .5-1.25z'] },
  schedule: { paths: [CIRCLE, 'M12 6.75V12l3.5 2.25'] },
  history: { paths: ['M3.5 12a8.5 8.5 0 1 0 2.6-6.1', 'M3.75 4.25v4.5h4.5', 'M12 7.75V12l3.25 2'] },
  event: { paths: ['M4.25 5.75h15.5v14.5H4.25z', 'M4.25 10h15.5', 'M8.5 3.5v4', 'M15.5 3.5v4'] },
  sync: { paths: ['M20 12a8 8 0 0 1-13.4 5.9', 'M4 12a8 8 0 0 1 13.4-5.9', 'M17 2.75v3.75h-3.75', 'M7 21.25V17.5h3.75'] },
  sync_problem: { paths: ['M20 12a8 8 0 0 1-13.4 5.9', 'M4 12a8 8 0 0 1 13.4-5.9', 'M17 2.75v3.75h-3.75', 'M12 9v3.5', 'M12 15.9v.01'] },
  refresh: { paths: ['M19.75 12a7.75 7.75 0 1 1-2.3-5.5', 'M19.75 3.5v4.75H15'] },
  restart_alt: { paths: ['M19.75 12a7.75 7.75 0 1 1-3.15-6.25', 'M11.5 2.5 14.75 5.5 11.5 8.5'] },
  published_with_changes: { paths: ['M19.75 12a7.75 7.75 0 1 1-2.3-5.5', 'M19.75 3.5v4.75H15', 'm8.75 12 2.25 2.25 4.25-4.5'] },

  /* ---------- documents & data ---------- */
  description: { paths: [DOC, DOC_FOLD, 'M8.75 12.5h6.5', 'M8.75 16h4.5'] },
  insert_drive_file: { paths: [DOC, DOC_FOLD] },
  note: { paths: [DOC, DOC_FOLD, 'M8.75 12.5h6.5'] },
  edit_note: { paths: ['M4.25 6.5h11', 'M4.25 11h7.5', 'M4.25 15.5h5', 'm13 19.75.5-2.75 5.5-5.5a1.25 1.25 0 0 1 1.75 0l.5.5a1.25 1.25 0 0 1 0 1.75l-5.5 5.5z'] },
  notes: { paths: ['M4.25 7h15.5', 'M4.25 12h15.5', 'M4.25 17h9.5'] },
  list: { paths: ['M8.25 7h11.5', 'M8.25 12h11.5', 'M8.25 17h11.5', 'M4.5 7v.01', 'M4.5 12v.01', 'M4.5 17v.01'] },
  title: { paths: ['M5 5.75h14', 'M12 5.75v12.5'] },
  text_fields: { paths: ['M3.5 7.25h8', 'M7.5 7.25v11', 'M13.5 11.5h7', 'M17 11.5v6.75'] },

  /* ---------- text formatting (rich-text toolbar) ---------- */
  format_bold: { paths: ['M7.75 4.75h5a3.25 3.25 0 0 1 0 6.5h-5z', 'M7.75 11.25h5.75a4 4 0 0 1 0 8H7.75z'] },
  format_italic: { paths: ['M10.25 5.25h7.5', 'M6.25 18.75h7.5', 'm14.5 5.25-5 13.5'] },
  format_underlined: { paths: ['M6.75 4.5v6.75a5.25 5.25 0 0 0 10.5 0V4.5', 'M5.25 19.5h13.5'] },
  format_list_bulleted: { paths: ['M9 6.5h10.25', 'M9 12h10.25', 'M9 17.5h10.25', 'M4.75 6.5v.01', 'M4.75 12v.01', 'M4.75 17.5v.01'] },
  format_list_numbered: {
    paths: [
      'M9.5 6.5h9.75', 'M9.5 12h9.75', 'M9.5 17.5h9.75',
      'm4 5.4 1.4-.9V8.6', 'M3.9 10.9h2.4l-2.4 3.2h2.5', 'M3.9 16.3h2.4l-1.3 1.5h.3a1.1 1.1 0 1 1-1.4 1.1'
    ]
  },
  format_clear: { paths: ['M7.75 5.5h9.5', 'M12.9 5.5 10.6 14', 'M8.25 19h5.5', SLASH] },
  code: { paths: ['m8.75 8.5-4.5 3.5 4.5 3.5', 'm15.25 8.5 4.5 3.5-4.5 3.5', 'm13.5 5.25-3 13.5'] },
  picture_as_pdf: { paths: [DOC, DOC_FOLD, 'M8.5 12.25v4.5', 'M8.5 12.25h1.5a1.15 1.15 0 0 1 0 2.3H8.5', 'M13 16.75v-4.5h1.25a2.25 2.25 0 0 1 0 4.5z'] },
  folder: { paths: ['M3.75 6.25h5.5l2 2.5h9v10.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5z'] },
  attach_file: { paths: ['M16.5 8.25 9.6 15.2a2.4 2.4 0 0 0 3.4 3.4l7.25-7.25a4.4 4.4 0 0 0-6.2-6.2L6.5 12.7a6.35 6.35 0 0 0 9 9l5.25-5.25'] },
  content_copy: { paths: ['M8.75 8.75h10.5v10.5H8.75z', 'M15.25 8.75v-4H4.75v10.5h4'] },
  content_paste: { paths: [CLIP_BODY, CLIP_TAB] },
  content_paste_go: { paths: [CLIP_BODY, CLIP_TAB, 'M9.75 14.25h5.5', 'm13 12 2.25 2.25L13 16.5'] },
  save: { paths: ['M4.75 4.75h11.5l3 3v11.5H4.75z', 'M8 4.75v5h7v-5', 'M8 19.25v-6h8v6'] },
  download: { paths: ['M12 3.75v10.5', 'm7.75 10.5 4.25 4.25 4.25-4.25', 'M4.25 19.25h15.5'] },
  print: { paths: ['M7.25 8.25V3.75h9.5v4.5', 'M7.25 16.75H4.75a1 1 0 0 1-1-1V9.25a1 1 0 0 1 1-1h14.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-2.5', 'M7.25 12.75h9.5v7.5h-9.5z', 'M17.25 10.75v.01'] },
  upload: { paths: ['M12 20.25V9.75', 'm7.75 13.5 4.25-4.25 4.25 4.25', 'M4.25 4.75h15.5'] },
  upload_file: { paths: [DOC, DOC_FOLD, 'M12 19.25v-6.5', 'm9.5 15 2.5-2.5 2.5 2.5'] },
  publish: { paths: ['M4.25 4.75h15.5', 'M12 20.25V9.5', 'm7.5 14 4.5-4.5 4.5 4.5'] },
  cloud_upload: { paths: ['M6.75 18.25a4 4 0 0 1-.4-7.98 5.75 5.75 0 0 1 11.2-1.02 3.75 3.75 0 0 1 .7 7.4', 'M12 20.25v-8', 'm9.5 14.5 2.5-2.5 2.5 2.5'] },
  image: { paths: ['M3.75 4.75h16.5v14.5H3.75z', 'M8.75 10a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z', 'm3.75 16.25 5-5 4.5 4.5 3-2.5 4 3.5'] },
  photo_library: { paths: ['M8.75 3.75h11.5v11.5H8.75z', 'M15.25 18.25a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2V8.5', 'm8.75 12.5 3-3 3 2.5 2.5-2 2 2.25'] },
  camera_alt: { paths: ['M3.75 7.75h3.5l1.5-2.5h6.5l1.5 2.5h3.5v11.5H3.75z', 'M12 9.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z'] },
  audiotrack: { paths: ['M9.75 17.25a2.75 2.75 0 1 1-2.75-2.75 2.75 2.75 0 0 1 2.75 2.75z', 'M9.75 17.25V4.75l8.5-1.5v11.25', 'M18.25 14.5a2.75 2.75 0 1 1-2.75-2.75 2.75 2.75 0 0 1 2.75 2.75z'] },
  videocam: { paths: ['M3.75 6.75h11v10.5h-11z', 'm14.75 12 5.5-3.5v7z'] },
  table_chart: { paths: ['M3.75 4.75h16.5v14.5H3.75z', 'M3.75 9.25h16.5', 'M9.5 9.25v10'] },
  bar_chart: { paths: ['M5.5 19.25V11', 'M12 19.25V4.75', 'M18.5 19.25v-5.5'] },
  calculate: { paths: ['M4.75 3.75h14.5v16.5H4.75z', 'M8 8h3.5', 'M14 8h2', 'M8 13.25h8', 'M8 16.75h8'] },
  fact_check: { paths: ['M3.75 5.25h16.5v13.5H3.75z', 'M7.5 9.25h4.5', 'M7.5 14.75h4.5', 'm14.75 9.5 1.5 1.5 2.5-2.75', 'm14.75 15 1.5 1.5 2.5-2.75'] },
  horizontal_rule: { paths: ['M4.25 12h15.5'] },
  grid_view: { paths: ['M4.25 4.25h6v6h-6z', 'M13.75 4.25h6v6h-6z', 'M4.25 13.75h6v6h-6z', 'M13.75 13.75h6v6h-6z'] },
  dashboard: { paths: ['M4.25 4.25h6v8h-6z', 'M13.75 4.25h6v4.5h-6z', 'M13.75 12.25h6v7.5h-6z', 'M4.25 15.75h6v4h-6z'] },
  view_kanban: { paths: ['M3.75 4.75h16.5v14.5H3.75z', 'M9.25 4.75v14.5', 'M14.75 4.75v14.5'] },
  view_week: { paths: ['M3.75 5.75h4v12.5h-4z', 'M10 5.75h4v12.5h-4z', 'M16.25 5.75h4v12.5h-4z'] },
  view_list: { paths: ['M4.25 6h3v3h-3z', 'M4.25 15h3v3h-3z', 'M10 7.5h9.75', 'M10 16.5h9.75'] },
  category: { paths: ['m12 3.25 4 6.5h-8z', 'M6.5 13.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z', 'M14 13.75h6.25V20H14z'] },

  /* ---------- commerce ---------- */
  shopping_cart: { paths: [CART, CART_WHEELS] },
  add_shopping_cart: { paths: [CART, CART_WHEELS, 'M17.5 2.75v4.5', 'M15.25 5h4.5'] },
  production_quantity_limits: { paths: [CART, CART_WHEELS, 'M20.5 3.5v4', 'M20.5 10.4v.01'] },
  inventory_2: { paths: ['M12 2.75 20.25 7.1v9.8L12 21.25 3.75 16.9V7.1z', 'M3.9 7.05 12 11.5l8.1-4.45', 'M12 11.5v9.6'] },
  inventory: { paths: [CLIP_BODY, CLIP_TAB, 'M9.75 11.5h4.5', 'M9.75 15.25h4.5'] },
  sell: { paths: ['M11.4 3.75H20.25v8.85l-8.6 8.6a1.5 1.5 0 0 1-2.15 0l-6.7-6.7a1.5 1.5 0 0 1 0-2.15z', 'M16.5 7.5v.01'] },
  local_offer: { paths: ['M11.4 3.75H20.25v8.85l-8.6 8.6a1.5 1.5 0 0 1-2.15 0l-6.7-6.7a1.5 1.5 0 0 1 0-2.15z', 'M16.5 7.5v.01'] },
  payments: { paths: ['M2.75 6.5h15.5v9.5H2.75z', 'M10.5 9.5a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5z', 'M21.25 9.5v8a1.5 1.5 0 0 1-1.5 1.5H6'] },
  euro: { paths: ['M18 6.25a6.75 6.75 0 1 0 0 11.5', 'M4.5 10.25h8.5', 'M4.5 13.75h8.5'] },
  percent: { paths: ['m5.5 18.5 13-13', 'M7.5 5.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z', 'M16.5 14.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'] },
  receipt: { paths: ['M5.75 3.75h12.5v16.5l-2.5-1.5-2.5 1.5-2.5-1.5-2.5 1.5-2.5-1.5z', 'M9 8.5h6', 'M9 12.5h6'] },
  receipt_long: { paths: ['M5.75 3.75h12.5v16.5l-2.5-1.5-2.5 1.5-2.5-1.5-2.5 1.5-2.5-1.5z', 'M9 7.75h6', 'M9 11.25h6', 'M9 14.75h4'] },
  confirmation_number: { paths: ['M3.75 6.25h16.5v3.25a2.5 2.5 0 0 0 0 5v3.25H3.75V14.5a2.5 2.5 0 0 0 0-5z', 'M12 8v2', 'M12 14v2'] },
  store: { paths: ['M4.25 9.75h15.5v10h-15.5z', 'M3.25 4.75h17.5L19.5 9.5h-15z', 'M9.75 19.75v-5.5h4.5v5.5'] },
  storefront: { paths: ['M4.25 10h15.5v9.75h-15.5z', 'M2.75 4.75h18.5l-1 4a2.6 2.6 0 0 1-4.9.4 2.6 2.6 0 0 1-4.9 0 2.6 2.6 0 0 1-4.9-.4z', 'M9.75 19.75V14h4.5v5.75'] },
  local_shipping: { paths: ['M2.75 5.75h11v10.5h-11z', 'M13.75 9.25h3.75l3.5 3.5v3.5h-7.25z', 'M7.25 16.25a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5z', 'M17.75 16.25a2.25 2.25 0 1 1 0 4.5 2.25 2.25 0 0 1 0-4.5z'] },
  business: { paths: ['M3.75 20.25h16.5', 'M6.25 20.25V3.75h7.5v16.5', 'M13.75 20.25V9.5h4.5v10.75', 'M8.75 7.5h2.5', 'M8.75 11.5h2.5', 'M8.75 15.5h2.5', 'M15.5 13h1.25', 'M15.5 16.5h1.25'] },
  handshake: { paths: ['m2.75 10.5 4.25-4.25 5 2.25 5-2.25 4.25 4.25', 'M12 8.5 8.25 12.25a1.75 1.75 0 0 0 2.5 2.5l1.25-1.25 3.5 3.5', 'm12 13.5 2.5 2.5', 'M2.75 10.5 7 14.75', 'M21.25 10.5 17 14.75'] },

  /* ---------- people ---------- */
  person: { paths: [HEAD, SHOULDERS] },
  people: { paths: ['M9 4.25a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z', 'M2.75 20.25a6.25 6.25 0 0 1 12.5 0', 'M16.25 4.6a3.5 3.5 0 0 1 0 6.8', 'M17.6 14.4a6.25 6.25 0 0 1 3.65 5.85'] },
  groups: { paths: ['M12 5.75a3 3 0 1 1 0 6 3 3 0 0 1 0-6z', 'M6.75 20.25a5.25 5.25 0 0 1 10.5 0', 'M5 11.5a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5z', 'M19 11.5a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5z', 'M2.75 17.5a3.5 3.5 0 0 1 3-3.4', 'M21.25 17.5a3.5 3.5 0 0 0-3-3.4'] },
  person_add: { paths: ['M9.5 3.75a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5z', 'M2.5 20.25a7 7 0 0 1 12.25-4.6', 'M18.75 14v6', 'M15.75 17h6'] },
  person_remove: { paths: ['M9.5 3.75a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5z', 'M2.5 20.25a7 7 0 0 1 12.25-4.6', 'M15.75 17h6'] },
  admin_panel_settings: { paths: ['M12 2.75 20 5.5v6.25c0 4.6-3.35 7.9-8 9.5-4.65-1.6-8-4.9-8-9.5V5.5z', 'M12 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4z', 'M8.5 16.5a3.75 3.75 0 0 1 7 0'] },
  support_agent: { paths: ['M4.75 13.5v-1.5a7.25 7.25 0 0 1 14.5 0v1.5', 'M3.5 12.75h2.25v5H4.75a1.25 1.25 0 0 1-1.25-1.25z', 'M20.5 12.75h-2.25v5h1a1.25 1.25 0 0 0 1.25-1.25z', 'M18.25 17.75v.75a2.5 2.5 0 0 1-2.5 2.5H12.5'] },

  /* ---------- messaging ---------- */
  chat: { paths: [BUBBLE, 'M8.5 10.5h7', 'M8.5 13.5h4.5'] },
  chat_bubble: { paths: [BUBBLE], filled: false },
  chat_bubble_outline: { paths: [BUBBLE] },
  forum: { paths: ['M3.75 4.75h12.5v9h-8.5l-4 3.25v-3.25h0z', 'M8 17.5v1.5h8.75l3.5 2.75V10.5a1.5 1.5 0 0 0-1.5-1.5h-2.5'] },
  comment: { paths: [BUBBLE, 'M8.5 10.5h7'] },
  send: { paths: ['M21 3.5 2.75 11l7.5 2.75L13 21.25z', 'M10.25 13.75 21 3.5'] },
  email: { paths: ['M3.75 5.75h16.5v12.5H3.75z', 'm3.75 6.5 8.25 6.25 8.25-6.25'] },
  inbox: { paths: ['M3.75 4.75h16.5v14.5H3.75z', 'M3.75 13.5h4.5a3.75 3.75 0 0 0 7.5 0h4.5'] },
  campaign: { paths: ['M4.25 9.5h3.5l9-4.5v14l-9-4.5h-3.5z', 'M7.75 14.5v4.5h3v-3.75', 'M19.5 10.25h2', 'M19.5 13.75h2'] },

  /* ---------- telephony & network ---------- */
  phone: { paths: ['M7.5 3.75 10 8.5l-2 2.25a12.5 12.5 0 0 0 5.25 5.25L15.5 14l4.75 2.5v3a1.75 1.75 0 0 1-1.9 1.75C10.5 20.6 3.4 13.5 2.75 5.65A1.75 1.75 0 0 1 4.5 3.75z'] },
  phone_in_talk: { paths: ['M6.5 3.75 8.75 8l-1.9 2.15a11.5 11.5 0 0 0 5 5L14 13.25l4.25 2.25v2.75a1.6 1.6 0 0 1-1.75 1.6C9.4 19.2 3.3 13.1 2.65 5.5A1.6 1.6 0 0 1 4.25 3.75z', 'M16 7.5a4 4 0 0 1 0 3.5', 'M18.75 5.5a7 7 0 0 1 0 7.5'] },
  ring_volume: { paths: ['M12 8.75c-3.5 0-6.75 1.25-9.25 3.5v3.25l3.5.5.9-2.6A14 14 0 0 1 12 12.5c1.75 0 3.4.35 4.85.9l.9 2.6 3.5-.5V12.25A13.6 13.6 0 0 0 12 8.75z', 'M12 2.75v2.5', 'm5.75 4 1.5 1.75', 'm18.25 4-1.5 1.75'] },
  smartphone: { paths: ['M6.75 2.75h10.5v18.5H6.75z', 'M10.5 18.5h3'] },
  desktop_windows: { paths: [SCREEN, 'M12 16.25v3.5', 'M8.5 19.75h7'] },
  wifi: { paths: ['M2.75 9a14 14 0 0 1 18.5 0', 'M6.25 12.75a9 9 0 0 1 11.5 0', 'M9.5 16.25a4.25 4.25 0 0 1 5 0', 'M12 19.75v.01'] },
  wifi_off: { paths: ['M2.75 9a14 14 0 0 1 6.25-3.25', 'M14.5 5.9A13.9 13.9 0 0 1 21.25 9', 'M6.25 12.75a9 9 0 0 1 3-1.9', 'M9.5 16.25a4.25 4.25 0 0 1 5 0', 'M12 19.75v.01', SLASH] },
  signal_wifi_off: { paths: ['M2.75 9a14 14 0 0 1 6.25-3.25', 'M14.5 5.9A13.9 13.9 0 0 1 21.25 9', 'M6.25 12.75a9 9 0 0 1 3-1.9', 'M9.5 16.25a4.25 4.25 0 0 1 5 0', 'M12 19.75v.01', SLASH] },
  wifi_tethering: { paths: ['M12 10.25a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5z', 'M7.75 16.25a6 6 0 0 1 0-8.5', 'M16.25 7.75a6 6 0 0 1 0 8.5', 'M5 19a9.75 9.75 0 0 1 0-14', 'M19 5a9.75 9.75 0 0 1 0 14'] },
  network_check: { paths: ['M4 19.25v-3.5', 'M8.5 19.25v-6.5', 'M13 19.25v-9.5', 'M17.5 19.25V6.5', 'm3.5 8.75 2.5 2.5 5-5.5'] },
  webhook: { paths: ['M12 3.75a3.25 3.25 0 0 1 2.9 4.7l3.1 5.4', 'M9.1 8.45 6 13.85', 'M18 13.85a3.25 3.25 0 1 1-2.9 4.7H8.9', 'M6 13.85a3.25 3.25 0 1 0 2.9 4.7'] },
  public: { paths: [CIRCLE, 'M2.75 12h18.5', 'M12 2.75a14 14 0 0 1 0 18.5 14 14 0 0 1 0-18.5z'] },
  language: { paths: [CIRCLE, 'M2.75 12h18.5', 'M12 2.75a14 14 0 0 1 0 18.5 14 14 0 0 1 0-18.5z'] },
  translate: { paths: ['M3.25 5.75h8.5', 'M7.5 4v1.75', 'M9.75 5.75c0 3.5-2.75 7-6.5 8.5', 'M5.5 9.75c1 2 2.75 3.5 4.75 4.25', 'm12.5 20.25 4-9.5 4 9.5', 'M13.9 17.25h5.2'] },

  /* ---------- settings & tools ---------- */
  settings: { paths: [GEAR_TEETH, 'M12 9.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5z'] },
  tune: { paths: ['M3.75 7h16.5', 'M3.75 12h16.5', 'M3.75 17h16.5', 'M8.5 5.25v3.5', 'M15 10.25v3.5', 'M10 15.25v3.5'] },
  build: { paths: ['M14.5 3.5a5 5 0 0 0-1.35 8.4L4.6 20.4a1.75 1.75 0 0 0 2.5 2.45l8.4-8.4A5 5 0 0 0 20 6.25l-2.75 2.75-2.25-2.25L17.75 4a5 5 0 0 0-3.25-.5z'] },
  cleaning_services: { paths: ['M9.25 3.75h5.5v6.5h-5.5z', 'M7.5 10.25h9l1 4.25h-11z', 'M8 14.5v5.75', 'M12 14.5v5.75', 'M16 14.5v5.75'] },
  science: { paths: ['M9.5 3.75v6.5L4.4 18.6a1.5 1.5 0 0 0 1.3 2.15h12.6a1.5 1.5 0 0 0 1.3-2.15L14.5 10.25v-6.5', 'M8 3.75h8', 'M6.75 15.25h10.5'] },
  palette: { paths: ['M12 2.75c5.1 0 9.25 3.7 9.25 8.25 0 2.6-2.1 4-4.25 4h-1.5a2 2 0 0 0-1.4 3.4c.55.6.4 1.6-.35 1.85a9.7 9.7 0 0 1-1.75.25c-5.1 0-9.25-4.15-9.25-9.25S6.9 2.75 12 2.75z', 'M7.75 11.5v.01', 'M10 7.75v.01', 'M14.5 7.75v.01', 'M17.25 11v.01'] },
  brush: { paths: ['M17.5 3.5a2.1 2.1 0 0 1 3 3l-7.25 7.25-3-3z', 'M9.5 12.25 12 14.75 8.5 18.25a3.5 3.5 0 0 1-5.75-3.5z'] },
  school: { paths: ['m12 4.25 9.25 4.5L12 13.25 2.75 8.75z', 'M6.5 10.75v5.25c0 1.9 2.5 3.25 5.5 3.25s5.5-1.35 5.5-3.25v-5.25', 'M21.25 8.75v5.5'] },
  menu_book: { paths: ['M12 6.75C10.25 5.4 7.9 4.75 4.75 4.75v13c3.15 0 5.5.65 7.25 2 1.75-1.35 4.1-2 7.25-2v-13c-3.15 0-5.5.65-7.25 2z', 'M12 6.75v13'] },
  gavel: { paths: ['m4.25 19.75 6.5-6.5', 'm8.5 8.5 5 5', 'm12.25 4.75 5.5 5.5', 'm9.75 7.25 5.5 5.5', 'm14.5 12 5.5-5.5', 'M11.75 21h9'] },
  health_and_safety: { paths: ['M12 2.75 20 5.5v6.25c0 4.6-3.35 7.9-8 9.5-4.65-1.6-8-4.9-8-9.5V5.5z', 'M12 8.5v6', 'M9 11.5h6'] },
  auto_awesome: { paths: ['m11 4.5 1.9 4.35 4.35 1.9-4.35 1.9L11 17l-1.9-4.35-4.35-1.9 4.35-1.9z', 'M18 4v3', 'M16.5 5.5h3', 'M18.25 15.5v2.5', 'M17 16.75h2.5'] },
  light_mode: { paths: ['M12 7.75a4.25 4.25 0 1 1 0 8.5 4.25 4.25 0 0 1 0-8.5z', 'M12 2.75v2', 'M12 19.25v2', 'M4.75 12h-2', 'M21.25 12h-2', 'm6.6 6.6-1.4-1.4', 'm18.8 18.8-1.4-1.4', 'm6.6 17.4-1.4 1.4', 'm18.8 5.2-1.4 1.4'] },
  dark_mode: { paths: ['M20.5 14.25A8.75 8.75 0 0 1 9.75 3.5a8.75 8.75 0 1 0 10.75 10.75z'] },
  settings_brightness: { paths: ['M3.75 4.75h16.5v14.5H3.75z', 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z', 'M12 6.25v-.01', 'M12 17.75v.01'] },

  /* ---------- location ---------- */
  location_on: { paths: ['M12 21.25s7-6.1 7-11.25a7 7 0 1 0-14 0c0 5.15 7 11.25 7 11.25z', 'M12 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z'] },
  location_off: { paths: ['M12 21.25s7-6.1 7-11.25a7 7 0 0 0-9.9-6.35', 'M6.05 6.4A7 7 0 0 0 5 10c0 5.15 7 11.25 7 11.25', SLASH] },

  /* ---------- editing & search ---------- */
  edit: { paths: ['m4.75 19.25.7-3.9L15.6 5.2a1.75 1.75 0 0 1 2.475 0l.725.725a1.75 1.75 0 0 1 0 2.475L8.65 18.55z', 'm14.4 6.4 3.2 3.2'] },
  search: { paths: ['M10.75 3.75a7 7 0 1 1 0 14 7 7 0 0 1 0-14z', 'm15.75 15.75 4.5 4.5'] },
  search_off: { paths: ['M17.5 12.25a7 7 0 0 0-8.9-8.15', 'M5.4 6.4a7 7 0 0 0 9.4 9.6', 'm15.75 15.75 4.5 4.5', SLASH] },
  filter_list: { paths: ['M3.5 5.75h17l-6.75 7.9v5.1l-3.5 2v-7.1z'] },
  filter_list_off: { paths: ['M7.75 5.75h12.75l-6.5 7.6', 'M10.25 12.5v5.15l3.5 2v-4.15', SLASH] },
  swap_horiz: { paths: ['M4.25 9.25h13.5', 'm14.5 6 3.25 3.25L14.5 12.5', 'M19.75 14.75H6.25', 'm9.5 11.5-3.25 3.25L9.5 18'] },
  drive_file_move: { paths: ['M3.75 6.25h5.5l2 2.5h9v10.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5z', 'M9.75 14h6', 'm13.5 11.75 2.25 2.25-2.25 2.25'] },
  delete: { paths: [TRASH_LID, TRASH_CAN, TRASH_HANDLE] },
  delete_outline: { paths: [TRASH_LID, TRASH_CAN, TRASH_HANDLE] },
  delete_forever: { paths: [TRASH_LID, TRASH_CAN, TRASH_HANDLE, 'm9.75 11.5 4.5 4.5', 'm14.25 11.5-4.5 4.5'] },
  delete_sweep: { paths: [TRASH_LID, TRASH_CAN, TRASH_HANDLE, 'M2.5 10.5h2', 'M2.5 14h2', 'M2.5 17.5h2'] },

  /* ---------- brand ---------- */
  /* The installation's mark. Geometry generated by scripts/brand-mark.js —
     edit the sector table there and re-run scripts/gen-brand-assets.js, which
     also refreshes the favicon and manifest rasters from the same source. */
  brand_mark: {
    filled: true,
    paths: [
    /* GENERATED — npm run gen:brand */
      'M17.736 20.192 A10 10 0 1 1 17.736 3.808 L15.355 7.208 A5.85 5.85 0 1 0 15.355 16.792 Z',
      'M18.82 4.686 A10 10 0 0 1 21.336 8.416 L17.461 9.904 A5.85 5.85 0 0 0 15.99 7.722 Z',
      'M21.744 9.75 A10 10 0 0 1 21.744 14.25 L17.7 13.316 A5.85 5.85 0 0 0 17.7 10.684 Z',
      'M21.336 15.584 A10 10 0 0 1 18.82 19.314 L15.99 16.278 A5.85 5.85 0 0 0 17.461 14.096 Z',
    /* END GENERATED */
    ],
  },

  /* ---------- misc ---------- */
  dot: { paths: ['M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z'], filled: true },
};

export type IconName = keyof typeof ICONS;
