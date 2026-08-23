import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
import {
  AIAvailability,
  AIGlossaryTerm,
  AISettings,
  AISettingsUpdate,
  AITestResult,
  AITranslateProposal,
  AITranslateRequest,
  AIUsageSummary
} from '../models/ai.model';

/**
 * The content editor's AI assistant.
 *
 * Two route groups on purpose: `/admin/ai` is configuration (admin only apart
 * from reading the glossary) and `/admin/content/ai` is the operations, which
 * live under the content route because the assistant acts on the page being
 * edited and has no other call site in the portal.
 */
@Injectable({ providedIn: 'root' })
export class AIService {
  private readonly settingsUrl = `${environment.apiUrl}/admin/ai`;
  private readonly editorUrl = `${environment.apiUrl}/admin/content/ai`;

  constructor(private http: HttpClient) {}

  // --- settings (admin only) -------------------------------------------------

  getSettings(): Observable<AISettings> {
    return this.http
      .get<ApiResponse<AISettings>>(`${this.settingsUrl}/settings`)
      .pipe(map(r => r.data));
  }

  updateSettings(update: AISettingsUpdate): Observable<AISettings> {
    return this.http
      .put<ApiResponse<AISettings>>(`${this.settingsUrl}/settings`, { data: update })
      .pipe(map(r => r.data));
  }

  /** Makes one minimal call. A wrong key answers ok=false, not an HTTP error. */
  testConnection(): Observable<AITestResult> {
    return this.http
      .post<ApiResponse<AITestResult>>(`${this.settingsUrl}/settings/test`, { data: {} })
      .pipe(map(r => r.data));
  }

  getUsage(days = 30): Observable<AIUsageSummary[]> {
    return this.http
      .get<ApiResponse<AIUsageSummary[]>>(`${this.settingsUrl}/usage?days=${days}`)
      .pipe(map(r => r.data || []));
  }

  // --- glossary --------------------------------------------------------------

  /** Readable by content editors: it is the portal's terminology reference. */
  listGlossary(): Observable<AIGlossaryTerm[]> {
    return this.http
      .get<ApiResponse<AIGlossaryTerm[]>>(`${this.settingsUrl}/glossary`)
      .pipe(map(r => r.data || []));
  }

  saveGlossary(terms: AIGlossaryTerm[]): Observable<string[]> {
    return this.http
      .post<ApiResponse<string[]>>(`${this.settingsUrl}/glossary`, { data: terms })
      .pipe(map(r => r.data || []));
  }

  deleteGlossary(uids: string[]): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.settingsUrl}/glossary/delete`, { data: uids })
      .pipe(map(() => void 0));
  }

  // --- editor operations -----------------------------------------------------

  /** Whether to offer the ✨ actions at all, and why not when the answer is no. */
  getAvailability(): Observable<AIAvailability> {
    return this.http
      .get<ApiResponse<AIAvailability>>(`${this.editorUrl}/availability`)
      .pipe(map(r => r.data));
  }

  /**
   * Returns a proposal. Nothing is written — the editor accepts block by block
   * and the page is saved by the ordinary save that follows.
   */
  translatePage(request: AITranslateRequest): Observable<AITranslateProposal> {
    return this.http
      .post<ApiResponse<AITranslateProposal>>(`${this.editorUrl}/translate`, { data: request })
      .pipe(map(r => r.data));
  }
}
