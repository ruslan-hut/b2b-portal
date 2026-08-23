/**
 * A Partner Resources media asset — a PDF or image attached to partner content.
 *
 * Bytes are fetched from `/content/files/{uid}`, never from a direct path:
 * access depends on who is asking, so the backend streams them.
 */
export interface ContentFile {
  uid: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  checksum?: string;
  /** Document's own language, independent of the page it hangs on. */
  language?: string;
  /**
   * The date the document itself carries, not the upload date — an SDS revised
   * 27.05.2026 keeps that date however often it is re-uploaded.
   */
  revision_date?: string;
  /** UID of the file that replaces this one; absent means current version. */
  superseded_by?: string;
  uploaded_by?: string;
  download_count: number;
  created_at: string;
  last_update: string;
  /** How many pages reference this file. Guards deletion. */
  usage_count: number;
}

/** Editable metadata. Omitted fields are left untouched by the backend. */
export interface ContentFileUpdate {
  uid: string;
  filename?: string;
  language?: string;
  revision_date?: string;
  superseded_by?: string;
}
