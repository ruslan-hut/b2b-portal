import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ContentFile } from '../../../core/models/content-file.model';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ContentFileService } from '../../../core/services/content-file.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PageTitleService } from '../../../core/services/page-title.service';
import { TranslationService } from '../../../core/services/translation.service';

/** An upload in flight, shown as a row above the list. */
interface PendingUpload {
  name: string;
  percent: number;
  error?: string;
}

/**
 * The file open in the details panel, and the edits made to it.
 *
 * A copy rather than the row itself: an editor who opens a file, retypes its
 * name and then closes the panel has not renamed anything, and a bound row
 * would already show the new name.
 */
interface FileDraft {
  uid: string;
  filename: string;
  language: string;
  revision_date: string;
}

@Component({
  selector: 'app-content-files',
  templateUrl: './files.component.html',
  styleUrls: ['./files.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContentFilesComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  files: ContentFile[] = [];
  uploads: PendingUpload[] = [];

  loading = false;
  error: string | null = null;
  isDragging = false;
  isAdmin = false;

  /** Files being fetched for a save, so their button can say it is working. */
  readonly downloading = new Set<string>();

  /**
   * The details panel.
   *
   * `ContentFileService` has carried `updateMetadata()` and `replace()` since
   * the module shipped and nothing called either, so a document's language and
   * revision date — two of the five columns in this table — were unfillable,
   * and the page editor had to *guess* a file's language from its filename. The
   * panel is where those are set.
   */
  editing: ContentFile | null = null;
  draft: FileDraft | null = null;
  savingDraft = false;
  replacing = false;
  replacePercent = 0;

  search = '';
  mimeFilter = '';
  currentPage = 1;
  pageSize = 50;
  total = 0;
  totalPages = 1;

  /** Filter chips. Values match the backend's mime-prefix filter. */
  readonly mimeOptions = [
    { value: '', labelKey: 'admin.contentFiles.filterAll' },
    { value: 'application/pdf', labelKey: 'admin.contentFiles.filterDocuments' },
    { value: 'image/', labelKey: 'admin.contentFiles.filterImages' }
  ];

  constructor(
    private filesService: ContentFileService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private pageTitle: PageTitleService,
    private translation: TranslationService,
    private confirmDialog: ConfirmDialogService,
    private notifications: NotificationService
  ) {}

  ngOnInit(): void {
    this.pageTitle.setTitle(this.translation.instant('admin.contentFiles.title'));
    this.isAdmin = this.auth.isAdmin;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.filesService
      .list({
        page: this.currentPage,
        count: this.pageSize,
        search: this.search.trim(),
        mime: this.mimeFilter
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.files = result.files;
          this.total = result.total;
          this.totalPages = result.totalPages;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to load content files:', err);
          this.error = this.translation.instant('admin.contentFiles.loadError');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.load();
  }

  onMimeFilterChange(value: string): void {
    this.mimeFilter = value;
    this.currentPage = 1;
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.load();
  }

  // --- Upload ---------------------------------------------------------------

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
    this.cdr.markForCheck();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    this.cdr.markForCheck();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const dropped = event.dataTransfer?.files;
    if (dropped?.length) {
      this.uploadAll(Array.from(dropped));
    }
    this.cdr.markForCheck();
  }

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.uploadAll(Array.from(input.files));
    }
    // Reset so picking the same file twice still fires a change event.
    input.value = '';
  }

  private uploadAll(files: File[]): void {
    files.forEach(file => this.uploadOne(file));
  }

  private uploadOne(file: File): void {
    const pending: PendingUpload = { name: file.name, percent: 0 };
    this.uploads = [...this.uploads, pending];
    this.cdr.markForCheck();

    this.filesService
      .upload(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: progress => {
          pending.percent = progress.percent;
          if (progress.done) {
            this.removePending(pending);
            this.load();
          }
          this.cdr.markForCheck();
        },
        error: err => {
          // Keep the failed row visible with its reason rather than dropping
          // it silently — the usual causes (too large, wrong type) are things
          // the editor can act on.
          pending.error = err?.error?.status_message || this.translation.instant('admin.contentFiles.uploadError');
          this.cdr.markForCheck();
        }
      });
  }

  dismissUpload(pending: PendingUpload): void {
    this.removePending(pending);
    this.cdr.markForCheck();
  }

  private removePending(pending: PendingUpload): void {
    this.uploads = this.uploads.filter(u => u !== pending);
  }

  // --- Row actions ----------------------------------------------------------

  /**
   * Fetches a file and hands it to the browser to save.
   *
   * Not an `<a href>`: the stream endpoint authenticates the session's bearer
   * token, which an element-initiated request does not carry, so a plain link
   * came back 401.
   */
  download(file: ContentFile): void {
    if (this.downloading.has(file.uid)) return;

    this.downloading.add(file.uid);
    this.filesService.save(file.uid, file.filename)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.finishDownload(file.uid),
        error: err => {
          console.error('Failed to download file:', err);
          this.notifications.error(this.translation.instant('admin.contentFiles.downloadFailed'));
          this.finishDownload(file.uid);
        }
      });
  }

  private finishDownload(uid: string): void {
    this.downloading.delete(uid);
    this.cdr.markForCheck();
  }

  async deleteFile(file: ContentFile): Promise<void> {
    if (file.usage_count > 0) {
      this.notifications.error(
        this.translation.instant('admin.contentFiles.deleteInUse', { count: file.usage_count })
      );
      return;
    }

    const message = this.translation.instant('admin.contentFiles.deleteConfirm', { name: file.filename });
    if (!(await this.confirmDialog.ask({ message, danger: true }))) return;

    this.filesService
      .delete([file.uid])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.load(),
        error: err => {
          console.error('Failed to delete content file:', err);
          this.notifications.error(this.translation.instant('admin.contentFiles.deleteError'));
        }
      });
  }

  // --- Details panel --------------------------------------------------------

  openDetails(file: ContentFile): void {
    this.editing = file;
    this.draft = {
      uid: file.uid,
      filename: file.filename,
      language: file.language || '',
      // The API hands dates back with a time component; the date input wants
      // exactly ten characters and silently shows nothing for anything else.
      revision_date: (file.revision_date || '').slice(0, 10)
    };
    this.replacePercent = 0;
    this.cdr.markForCheck();
  }

  closeDetails(): void {
    if (this.savingDraft || this.replacing) return;
    this.editing = null;
    this.draft = null;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.editing) this.closeDetails();
  }

  get isImage(): boolean {
    return !!this.editing?.mime_type?.startsWith('image/');
  }

  saveDetails(): void {
    const draft = this.draft;
    if (!draft || this.savingDraft) return;

    const filename = draft.filename.trim();
    if (!filename) {
      this.notifications.error(this.translation.instant('admin.contentFiles.nameRequired'));
      return;
    }

    this.savingDraft = true;
    this.cdr.markForCheck();

    this.filesService
      .updateMetadata([{
        uid: draft.uid,
        filename,
        // Sent even when empty rather than omitted: an omitted key means
        // "leave it alone", so clearing a field would silently do nothing.
        language: draft.language.trim().toLowerCase(),
        revision_date: this.wireDate(draft.revision_date)
      }])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingDraft = false;
          this.editing = null;
          this.draft = null;
          this.notifications.success(this.translation.instant('admin.contentFiles.detailsSaved'));
          this.load();
        },
        error: err => {
          this.savingDraft = false;
          this.notifications.error(
            err?.error?.status_message || this.translation.instant('admin.contentFiles.detailsError')
          );
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * A date input's value in the shape the API parses.
   *
   * The field is a `*time.Time` on the server, so it wants RFC 3339 and rejects
   * the `YYYY-MM-DD` a `<input type="date">` produces — the whole batch fails,
   * not just the date. An empty field becomes the zero time, which the
   * repository writes as NULL: that is how a revision date is cleared.
   */
  private wireDate(value: string): string {
    return value ? `${value}T00:00:00Z` : '0001-01-01T00:00:00Z';
  }

  /**
   * Uploads new bytes behind the same uid.
   *
   * The point of replacing rather than uploading afresh: every page that links
   * this document picks up the new revision without being edited. An SDS
   * reissued in May reaches all four markets by touching one row here.
   */
  onReplacePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.editing || this.replacing) return;

    const uid = this.editing.uid;
    this.replacing = true;
    this.replacePercent = 0;
    this.cdr.markForCheck();

    this.filesService
      .replace(uid, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: progress => {
          this.replacePercent = progress.percent;
          if (progress.done) {
            this.replacing = false;
            this.editing = null;
            this.draft = null;
            this.notifications.success(this.translation.instant('admin.contentFiles.replaced'));
            this.load();
          }
          this.cdr.markForCheck();
        },
        error: err => {
          this.replacing = false;
          this.notifications.error(
            err?.error?.status_message || this.translation.instant('admin.contentFiles.uploadError')
          );
          this.cdr.markForCheck();
        }
      });
  }

  // --- Display helpers ------------------------------------------------------

  /** Icon-registry name for a file's type. */
  iconFor(file: ContentFile): string {
    if (file.mime_type === 'application/pdf') return 'picture_as_pdf';
    if (file.mime_type.startsWith('image/')) return 'image';
    return 'insert_drive_file';
  }

  /** Human-readable size. Documents are KB/MB; bytes are never useful here. */
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  isSuperseded(file: ContentFile): boolean {
    return !!file.superseded_by;
  }

  trackByUid(_index: number, file: ContentFile): string {
    return file.uid;
  }

  trackByName(_index: number, upload: PendingUpload): string {
    return upload.name;
  }
}
