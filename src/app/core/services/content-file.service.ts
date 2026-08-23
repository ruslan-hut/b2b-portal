import { HttpClient, HttpEvent, HttpEventType, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, shareReplay, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
import { ContentFile, ContentFileUpdate } from '../models/content-file.model';

export interface ContentFileListParams {
  page?: number;
  count?: number;
  language?: string;
  /** Matches the start of the mime type, e.g. 'image/' or 'application/pdf'. */
  mime?: string;
  search?: string;
  currentOnly?: boolean;
}

export interface ContentFileListResult {
  files: ContentFile[];
  total: number;
  totalPages: number;
}

/** Progress of an in-flight upload, or the stored file once complete. */
export interface UploadProgress {
  /** 0–100. Reaches 100 only when the server has replied. */
  percent: number;
  done: boolean;
  file?: ContentFile;
}

@Injectable({ providedIn: 'root' })
export class ContentFileService {
  private readonly adminUrl = `${environment.apiUrl}/admin/content/files`;
  private readonly publicUrl = `${environment.apiUrl}/content/files`;

  /** In-flight and resolved blob URLs, keyed by file uid. */
  private readonly objectUrls = new Map<string, Observable<string>>();

  constructor(private http: HttpClient) {}

  list(params: ContentFileListParams = {}): Observable<ContentFileListResult> {
    const query = new URLSearchParams();
    query.set('page', String(params.page ?? 1));
    query.set('count', String(params.count ?? 50));
    if (params.language) query.set('language', params.language);
    if (params.mime) query.set('mime', params.mime);
    if (params.search) query.set('search', params.search);
    if (params.currentOnly) query.set('current_only', 'true');

    return this.http.get<ApiResponse<ContentFile[]>>(`${this.adminUrl}?${query.toString()}`).pipe(
      map(response => ({
        files: response.data || [],
        total: response.pagination?.total ?? (response.data?.length || 0),
        totalPages: response.pagination?.total_pages ?? 1
      }))
    );
  }

  /**
   * Uploads one file, reporting progress.
   *
   * Uses a raw HttpRequest rather than http.post so `reportProgress` is
   * available — a 50 MB PDF over a slow connection needs a progress bar, not a
   * frozen dialog.
   */
  upload(file: File): Observable<UploadProgress> {
    return this.send(new HttpRequest('POST', this.adminUrl, this.formFor(file), { reportProgress: true }));
  }

  /**
   * Replaces the bytes behind an existing file UID. Every page that links the
   * document picks up the new revision without being edited.
   */
  replace(uid: string, file: File): Observable<UploadProgress> {
    const url = `${this.adminUrl}/${encodeURIComponent(uid)}/replace`;
    return this.send(new HttpRequest('POST', url, this.formFor(file), { reportProgress: true }));
  }

  updateMetadata(updates: ContentFileUpdate[]): Observable<void> {
    return this.http.post<ApiResponse<null>>(`${this.adminUrl}/update`, { data: updates }).pipe(map(() => void 0));
  }

  delete(uids: string[]): Observable<void> {
    return this.http.post<ApiResponse<null>>(`${this.adminUrl}/delete`, { data: uids }).pipe(map(() => void 0));
  }

  /**
   * The API path a file streams from.
   *
   * Only ever fed to HttpClient. It is *not* usable as an `<img src>` or an
   * `<a href>`: the endpoint authenticates the bearer token, which the browser
   * does not attach to element-initiated requests, so those arrive with no
   * Authorization header and are refused with a 401. Everything that needs the
   * bytes in the DOM goes through objectUrl() or save() below.
   */
  private fileUrl(uid: string): string {
    return `${this.publicUrl}/${encodeURIComponent(uid)}`;
  }

  /**
   * A blob URL for a file, for use as an image source.
   *
   * Cached per uid: one request however many cards show the same picture, and
   * the URL stays valid for the life of the page. A failed fetch drops out of
   * the cache so the next attempt retries rather than replaying the error for
   * the rest of the session.
   */
  objectUrl(uid: string): Observable<string> {
    const cached = this.objectUrls.get(uid);
    if (cached) return cached;

    const url$ = this.http.get(this.fileUrl(uid), { responseType: 'blob' }).pipe(
      map(blob => URL.createObjectURL(blob)),
      catchError(err => {
        this.objectUrls.delete(uid);
        return throwError(() => err);
      }),
      shareReplay(1)
    );

    this.objectUrls.set(uid, url$);
    return url$;
  }

  /**
   * Downloads a file under its own name.
   *
   * The bytes are fetched rather than linked for the same reason as above, so
   * the save starts only once the whole file has arrived — which is why the
   * caller gets an observable to show progress or an error against, instead of
   * a link that silently does nothing.
   */
  save(uid: string, filename: string): Observable<void> {
    return this.http.get(this.fileUrl(uid), { responseType: 'blob' }).pipe(
      map(blob => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename || uid;
        anchor.click();
        // Revoked on the next tick, not immediately: the click is asynchronous
        // and a revoked URL cancels the save it was meant to start.
        setTimeout(() => URL.revokeObjectURL(url), 0);
      })
    );
  }

  private formFor(file: File): FormData {
    const form = new FormData();
    form.append('file', file, file.name);
    return form;
  }

  private send(request: HttpRequest<FormData>): Observable<UploadProgress> {
    return this.http.request<ApiResponse<ContentFile>>(request).pipe(
      map((event: HttpEvent<ApiResponse<ContentFile>>) => {
        if (event.type === HttpEventType.UploadProgress) {
          // Cap at 99: the bytes are sent but the server has not confirmed the
          // row was written, and showing 100% before that reads as "saved".
          const percent = event.total ? Math.min(99, Math.round((100 * event.loaded) / event.total)) : 0;
          return { percent, done: false };
        }
        if (event.type === HttpEventType.Response) {
          return { percent: 100, done: true, file: event.body?.data ?? undefined };
        }
        return { percent: 0, done: false };
      })
    );
  }
}
