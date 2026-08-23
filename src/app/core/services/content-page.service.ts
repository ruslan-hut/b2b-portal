import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
import {
  AudienceReach,
  ContentImportRequest,
  ContentImportResult,
  ContentLanguage,
  ContentPage,
  ContentPagePublish,
  ContentPageReorder,
  FlatPageNode
} from '../models/content-page.model';

@Injectable({ providedIn: 'root' })
export class ContentPageService {
  private readonly adminUrl = `${environment.apiUrl}/admin/content`;
  private readonly clientUrl = `${environment.apiUrl}/content`;

  constructor(private http: HttpClient) {}

  // --- admin ----------------------------------------------------------------

  /** Flat page list including drafts and every translation. */
  listPages(): Observable<ContentPage[]> {
    return this.http
      .get<ApiResponse<ContentPage[]>>(`${this.adminUrl}/pages`)
      .pipe(map(r => r.data || []));
  }

  getPage(uid: string): Observable<ContentPage> {
    return this.http
      .get<ApiResponse<ContentPage>>(`${this.adminUrl}/pages/${encodeURIComponent(uid)}`)
      .pipe(map(r => r.data));
  }

  savePages(pages: ContentPage[]): Observable<string[]> {
    return this.http
      .post<ApiResponse<string[]>>(`${this.adminUrl}/pages`, { data: pages })
      .pipe(map(r => r.data || []));
  }

  deletePages(uids: string[]): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.adminUrl}/pages/delete`, { data: uids })
      .pipe(map(() => void 0));
  }

  reorderPages(moves: ContentPageReorder[]): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.adminUrl}/pages/reorder`, { data: moves })
      .pipe(map(() => void 0));
  }

  /** Backs the publish switch, both in the editor and on the hub itself. */
  setStatus(changes: ContentPagePublish[]): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.adminUrl}/pages/publish`, { data: changes })
      .pipe(map(() => void 0));
  }

  /** How many clients a country scope reaches, and how many have no address. */
  reach(countries: string[]): Observable<AudienceReach> {
    const query = countries.length ? `?countries=${encodeURIComponent(countries.join(','))}` : '';
    return this.http
      .get<ApiResponse<AudienceReach>>(`${this.adminUrl}/pages/reach${query}`)
      .pipe(map(r => r.data));
  }

  /** Registry including deactivated entries. */
  listLanguagesAdmin(): Observable<ContentLanguage[]> {
    return this.http
      .get<ApiResponse<ContentLanguage[]>>(`${this.adminUrl}/languages`)
      .pipe(map(r => r.data || []));
  }

  saveLanguages(languages: ContentLanguage[]): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.adminUrl}/languages`, { data: languages })
      .pipe(map(() => void 0));
  }

  deleteLanguages(codes: string[]): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.adminUrl}/languages/delete`, { data: codes })
      .pipe(map(() => void 0));
  }

  // --- client ---------------------------------------------------------------

  /**
   * Audience-filtered navigation tree.
   *
   * includeDrafts is honoured only for admins and content editors; anyone else
   * silently gets the published-only result, so the flag cannot be used to
   * discover that drafts exist.
   */
  getTree(lang?: string, includeDrafts = false): Observable<ContentPage[]> {
    const query = new URLSearchParams();
    if (lang) query.set('lang', lang);
    if (includeDrafts) query.set('include_drafts', 'true');

    return this.http
      .get<ApiResponse<ContentPage[]>>(`${this.clientUrl}/tree?${query.toString()}`)
      .pipe(map(r => r.data || []));
  }

  /**
   * Reads a page by its full slug chain ("legal/certificates").
   *
   * Segments are escaped individually so the separators survive: encoding the
   * path whole would turn every "/" into %2F and address a single page whose
   * slug contains slashes, which is not a page that can exist.
   */
  getPageByPath(path: string, lang?: string, includeDrafts = false): Observable<ContentPage> {
    const query = new URLSearchParams();
    if (lang) query.set('lang', lang);
    if (includeDrafts) query.set('include_drafts', 'true');

    const encoded = path
      .split('/')
      .filter(Boolean)
      .map(segment => encodeURIComponent(segment))
      .join('/');

    return this.http
      .get<ApiResponse<ContentPage>>(`${this.clientUrl}/pages/${encoded}?${query.toString()}`)
      .pipe(map(r => r.data));
  }

  /** Where a page lives on the partner side. */
  partnerLink(page: Pick<ContentPage, 'path' | 'slug'>): string {
    return `/partners/${page.path || page.slug}`;
  }

  /** Active languages for the hub's own switcher. */
  listLanguages(): Observable<ContentLanguage[]> {
    return this.http
      .get<ApiResponse<ContentLanguage[]>>(`${this.clientUrl}/languages`)
      .pipe(map(r => r.data || []));
  }

  // --- helpers --------------------------------------------------------------

  /**
   * Flattens a parent/child hierarchy into an indented list for the admin
   * table, ordered depth-first so a child always follows its parent.
   *
   * Carries a seen-set: the backend rejects cycles on write and drops them on
   * read, but a malformed payload must degrade to a short list rather than
   * hanging the browser tab.
   */
  flatten(pages: ContentPage[]): FlatPageNode[] {
    const byParent = new Map<string, ContentPage[]>();
    for (const page of pages) {
      const key = page.parent_uid || '';
      const siblings = byParent.get(key) || [];
      siblings.push(page);
      byParent.set(key, siblings);
    }

    for (const siblings of byParent.values()) {
      siblings.sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug));
    }

    const out: FlatPageNode[] = [];
    const seen = new Set<string>();

    const walk = (parentUid: string, depth: number): void => {
      for (const page of byParent.get(parentUid) || []) {
        if (seen.has(page.uid)) continue;
        seen.add(page.uid);
        out.push({ page, depth });
        walk(page.uid, depth + 1);
      }
    };

    walk('', 0);

    // Pages whose parent is missing would otherwise vanish from the admin list
    // with no way to fix them. Surface them at the root instead.
    for (const page of pages) {
      if (!seen.has(page.uid)) {
        out.push({ page, depth: 0 });
      }
    }
    return out;
  }

  /**
   * Converts pasted Notion (or Word, or Docs) content into blocks.
   *
   * Returns a proposal — the server writes nothing and never fetches anything
   * the paste references.
   */
  importContent(request: ContentImportRequest): Observable<ContentImportResult> {
    return this.http
      .post<ApiResponse<ContentImportResult>>(`${this.adminUrl}/pages/import`, { data: request })
      .pipe(map(r => r.data));
  }

  /** The title in a given language, falling back to any available. */
  titleFor(page: ContentPage, language: string): string {
    const translations = page.translations || [];
    const exact = translations.find(t => t.language.toLowerCase() === language.toLowerCase());
    if (exact) return exact.title;
    return page.title || translations[0]?.title || page.slug;
  }
}
