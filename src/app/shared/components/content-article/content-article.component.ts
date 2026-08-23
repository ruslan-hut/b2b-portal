import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import {
  ContentBlock,
  ContentFileRef,
  ContentPage,
  LinkCardsDisplay
} from '../../../core/models/content-page.model';
import { ContentFileService } from '../../../core/services/content-file.service';

/** A files-block row, joined with its file metadata. */
export interface DocumentRow {
  file?: ContentFileRef;
  label: string;
  language: string;
  market: string;
  superseded: boolean;
  replacement?: ContentFileRef;
}

/** Document rows under a heading, when the block groups by market or language. */
export interface DocumentGroup {
  key: string;
  rows: DocumentRow[];
}

/**
 * Renders a Partner Resources article — title, summary, blocks, child cards.
 *
 * Shared deliberately. The partner page and the admin editor's preview must
 * show the same thing, and the only way to guarantee that over time is for
 * there to be one renderer. A second implementation would agree on the day it
 * was written and drift on the next block type.
 *
 * Presentational only: no fetching, no routing decisions, no publication state.
 * Everything it needs arrives as an input.
 */
@Component({
  selector: 'app-content-article',
  templateUrl: './content-article.component.html',
  styleUrls: ['./content-article.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentArticleComponent {
  @Input() title = '';
  @Input() summary = '';
  @Input() blocks: ContentBlock[] = [];
  @Input() files: ContentFileRef[] = [];
  /** Child pages, rendered as link cards under an "In this section" heading. */
  @Input() children: ContentPage[] = [];

  /**
   * Which language's payload to render.
   *
   * Empty means the blocks already carry a server-resolved `payload` — how the
   * partner route receives them. The editor has the unresolved `payloads[]`
   * instead and passes the language it is editing, so a preview can render text
   * that has never been saved.
   */
  @Input() language = '';

  /**
   * Whether in-app links navigate.
   *
   * Off in the editor preview: following a link card out of the editor would
   * discard unsaved work. Downloads stay live either way — checking that a
   * document row points at the right PDF is a reason to open the preview.
   */
  @Input() linksActive = true;

  /** File uids currently being fetched, so a row can say it is working. */
  readonly downloading = new Set<string>();

  constructor(
    private fileService: ContentFileService,
    private cdr: ChangeDetectorRef
  ) {}

  // --- blocks ---------------------------------------------------------------

  payloadOf(block: ContentBlock): Record<string, any> {
    if (this.language) {
      return (block.payloads || []).find(p => p.language === this.language)?.payload || {};
    }
    return block.payload || {};
  }

  /**
   * Text blocks store a restricted HTML subset, stripped server-side on save.
   *
   * Returned as a plain string so `[innerHTML]` runs Angular's sanitiser over
   * it as well. That is deliberate belt and braces: this content is written by
   * staff and, since the AI assistant, partly proposed by a model, and it is
   * rendered to partners. The server sanitiser is the gate, but it only ever
   * ran on rows saved after it existed — trusting it here would leave anything
   * stored earlier rendering unescaped. In the editor preview it is the *only*
   * gate, because nothing has been through the server yet.
   */
  htmlOf(block: ContentBlock): string {
    return this.payloadOf(block)['html'] || '';
  }

  headingLevel(block: ContentBlock): number {
    return this.payloadOf(block)['level'] === 3 ? 3 : 2;
  }

  calloutTone(block: ContentBlock): string {
    return this.payloadOf(block)['tone'] || 'info';
  }

  calloutIcon(block: ContentBlock): string {
    switch (this.calloutTone(block)) {
      case 'warn': return 'warning';
      case 'danger': return 'error';
      case 'success': return 'check_circle';
      default: return 'info';
    }
  }

  cardsOf(block: ContentBlock): any[] {
    return this.payloadOf(block)['items'] || [];
  }

  /**
   * Which shape a link_cards block takes.
   *
   * Anything unrecognised falls back to `list`: the old blocks have no display
   * setting at all, and a block saved by a newer editor must still draw.
   */
  cardDisplay(block: ContentBlock): LinkCardsDisplay {
    return block.settings?.['display'] === 'cover' ? 'cover' : 'list';
  }

  /**
   * Fixed column count for a cover grid, or null for auto-fit.
   *
   * Fixed is what makes a title page look composed rather than reflowed — but
   * only down to the width where two columns stop being readable, which the
   * stylesheet handles with a container query, not this.
   */
  cardColumns(block: ContentBlock): number | null {
    const columns = Number(block.settings?.['columns']);
    return columns >= 2 && columns <= 4 ? columns : null;
  }

  cardLink(item: Record<string, any>): string {
    return item['url'] || '/partners';
  }

  /**
   * Whether a card points outside the portal.
   *
   * An absolute URL handed to routerLink navigates to a route that does not
   * exist, so external cards need an href. Checked by scheme rather than by a
   * flag on the item: the editor types the address, and what it starts with is
   * the only reliable statement of where it goes.
   */
  cardIsExternal(item: Record<string, any>): boolean {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(String(item['url'] || ''));
  }

  childLink(child: ContentPage): string {
    return `/partners/${child.path || child.slug}`;
  }

  // --- the document row (the hub's signature element) -----------------------

  /**
   * Groups a files block's rows.
   *
   * Grouping renders from item metadata rather than being hand-authored as
   * alternating heading and files blocks, which is what lets the same fields
   * drive both this and the editor.
   */
  documentGroups(block: ContentBlock): DocumentGroup[] {
    const items = this.payloadOf(block)['items'] || [];
    const groupBy = block.settings?.['group_by'] || 'none';
    const filesByUid = new Map((this.files || []).map(f => [f.uid, f]));

    const rows: DocumentRow[] = items.map((item: Record<string, any>) => {
      const file = filesByUid.get(item['file_uid']);
      const supersededBy = file?.superseded_by;
      return {
        file,
        label: item['label'] || file?.filename || '',
        language: (item['language'] || file?.language || '').toUpperCase(),
        market: (item['market'] || '').toUpperCase(),
        superseded: !!supersededBy,
        replacement: supersededBy ? filesByUid.get(supersededBy) : undefined
      };
    });

    if (groupBy === 'none') {
      return [{ key: '', rows }];
    }

    const groups = new Map<string, DocumentRow[]>();
    for (const row of rows) {
      const key = (groupBy === 'market' ? row.market : row.language) || '—';
      groups.set(key, [...(groups.get(key) || []), row]);
    }
    return [...groups.entries()].map(([key, groupRows]) => ({ key, rows: groupRows }));
  }

  /**
   * Saves a document.
   *
   * The whole file is fetched before the save starts — the endpoint needs the
   * bearer token, so the browser cannot be handed a URL to follow — which for
   * a large PDF is a wait with nothing on screen unless the row says so.
   */
  download(file?: ContentFileRef): void {
    if (!file || this.downloading.has(file.uid)) return;

    this.downloading.add(file.uid);
    this.fileService.save(file.uid, file.filename).subscribe({
      next: () => this.finishDownload(file.uid),
      error: err => {
        console.error('Failed to download content file:', err);
        this.finishDownload(file.uid);
      }
    });
  }

  private finishDownload(uid: string): void {
    this.downloading.delete(uid);
    this.cdr.markForCheck();
  }

  formatSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  iconForFile(row: DocumentRow): string {
    if (row.file?.mime_type === 'application/pdf') return 'picture_as_pdf';
    if (row.file?.mime_type?.startsWith('image/')) return 'image';
    return 'insert_drive_file';
  }

  trackByUid(_index: number, page: ContentPage): string {
    return page.uid;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
