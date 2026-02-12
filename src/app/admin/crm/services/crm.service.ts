import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { CrmStage, CrmTransition, CrmStageReorderRequest } from '../models/crm-stage.model';
import { CrmBoardResponse, CrmBoardResponseRaw, CrmBoardColumnRaw, CrmBoardOrderRaw, CrmBoardOrder, CrmBoardColumn, CrmOrderPipeline } from '../models/crm-board.model';
import { CrmOrderAssignment, CrmAssignOrdersRequest, CrmMyAssignedOrder } from '../models/crm-assignment.model';
import { CrmActivity, CrmCreateActivityRequest, CrmActivityTimelineResponse } from '../models/crm-activity.model';
import { CrmTask, CrmCreateTaskRequest, CrmUpdateTaskRequest, CrmTaskListResponse, CrmTaskStatus } from '../models/crm-task.model';
import { CrmDashboardStats, CrmWorkloadStats, CrmPipelineStageStats, CrmTaskStats, CrmDashboardFilters } from '../models/crm-dashboard.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  metadata?: {
    total?: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CrmService {
  private readonly baseUrl = `${environment.apiUrl}/admin/crm`;
  private stagesCache$: Observable<CrmStage[]> | undefined;
  private transitionsCache$: Observable<CrmTransition[]> | undefined;

  constructor(private http: HttpClient) {}

  // ============= Stages =============

  getStages(): Observable<CrmStage[]> {
    if (!this.stagesCache$) {
      this.stagesCache$ = this.http.get<ApiResponse<CrmStage[]>>(`${this.baseUrl}/stages`).pipe(
        map(response => response.data || []),
        shareReplay(1)
      );
    }
    return this.stagesCache$;
  }

  getStagesBatch(uids: string[]): Observable<CrmStage[]> {
    if (uids.length === 0) {
      return of([]);
    }
    return this.http.post<ApiResponse<CrmStage[]>>(`${this.baseUrl}/stages/batch`, { data: uids }).pipe(
      map(response => response.data || [])
    );
  }

  upsertStages(stages: CrmStage[]): Observable<string[]> {
    this.clearStagesCache();
    return this.http.post<ApiResponse<string[]>>(`${this.baseUrl}/stages`, { data: stages }).pipe(
      map(response => response.data || [])
    );
  }

  deleteStages(uids: string[]): Observable<void> {
    this.clearStagesCache();
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/stages/delete`, { data: uids }).pipe(
      map(() => undefined)
    );
  }

  reorderStages(reorderRequests: CrmStageReorderRequest[]): Observable<void> {
    this.clearStagesCache();
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/stages/reorder`, { data: reorderRequests }).pipe(
      map(() => undefined)
    );
  }

  clearStagesCache(): void {
    this.stagesCache$ = undefined;
  }

  // ============= Transitions =============

  getTransitions(): Observable<CrmTransition[]> {
    if (!this.transitionsCache$) {
      this.transitionsCache$ = this.http.get<ApiResponse<CrmTransition[]>>(`${this.baseUrl}/transitions`).pipe(
        map(response => response.data || []),
        shareReplay(1)
      );
    }
    return this.transitionsCache$;
  }

  upsertTransitions(transitions: CrmTransition[]): Observable<void> {
    this.clearTransitionsCache();
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/transitions`, { data: transitions }).pipe(
      map(() => undefined)
    );
  }

  deleteTransitions(transitions: CrmTransition[]): Observable<void> {
    this.clearTransitionsCache();
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/transitions/delete`, { data: transitions }).pipe(
      map(() => undefined)
    );
  }

  clearTransitionsCache(): void {
    this.transitionsCache$ = undefined;
  }

  // ============= Board =============

  getBoard(storeUid?: string, ordersPerStage: number = 50): Observable<CrmBoardResponse> {
    let params = new HttpParams().set('orders_per_stage', ordersPerStage.toString());
    if (storeUid) {
      params = params.set('store_uid', storeUid);
    }
    return this.http.get<ApiResponse<CrmBoardResponseRaw>>(`${this.baseUrl}/board`, { params }).pipe(
      map(response => this.transformBoardResponse(response.data))
    );
  }

  private transformBoardResponse(raw: CrmBoardResponseRaw | null): CrmBoardResponse {
    if (!raw || !raw.columns) {
      return { columns: [] };
    }

    const columns: CrmBoardColumn[] = raw.columns.map(col => this.transformColumn(col));
    return { columns };
  }

  private transformColumn(raw: CrmBoardColumnRaw): CrmBoardColumn {
    return {
      stage: raw.stage || { uid: '', name: 'Unknown', color: '#6366f1', sort_order: 0, is_initial: false, is_final: false, active: true },
      orders: (raw.orders || []).map(o => this.transformOrder(o)),
      total_count: raw.count || 0
    };
  }

  private transformOrder(raw: CrmBoardOrderRaw): CrmBoardOrder {
    return {
      uid: raw.order?.uid || '',
      number: raw.order?.number,
      client_uid: raw.order?.client_uid || '',
      client_name: raw.client?.name,
      store_uid: raw.order?.store_uid || '',
      status: raw.order?.status || '',
      total: raw.order?.total || 0,
      currency_code: raw.order?.currency_code || 'USD',
      created_at: raw.order?.created_at || '',
      assigned_user_uid: raw.assignment?.user_uid,
      assigned_user_name: raw.assignment?.user_name || raw.assignment?.user_uid
    };
  }

  moveOrder(orderUid: string, stageUid: string, validateTransition: boolean = true): Observable<void> {
    let params = new HttpParams();
    if (!validateTransition) {
      params = params.set('validate_transition', 'false');
    }
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/board/move`, {
      data: { order_uid: orderUid, stage_uid: stageUid }
    }, { params }).pipe(
      map(() => undefined)
    );
  }

  getOrderPipelineBatch(orderUids: string[]): Observable<CrmOrderPipeline[]> {
    if (orderUids.length === 0) {
      return of([]);
    }
    return this.http.post<ApiResponse<CrmOrderPipeline[]>>(`${this.baseUrl}/board/pipeline/batch`, { data: orderUids }).pipe(
      map(response => response.data || [])
    );
  }

  populatePipeline(storeUid?: string): Observable<{ added: number }> {
    let params = new HttpParams();
    if (storeUid) {
      params = params.set('store_uid', storeUid);
    }
    return this.http.post<ApiResponse<{ added: number }>>(`${this.baseUrl}/board/populate`, {}, { params }).pipe(
      map(response => response.data || { added: 0 })
    );
  }

  // ============= Assignments =============

  assignOrders(request: CrmAssignOrdersRequest): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/assignments`, { data: request }).pipe(
      map(() => undefined)
    );
  }

  getAssignmentsBatch(orderUids: string[]): Observable<CrmOrderAssignment[]> {
    if (orderUids.length === 0) {
      return of([]);
    }
    return this.http.post<ApiResponse<CrmOrderAssignment[]>>(`${this.baseUrl}/assignments/batch`, { data: orderUids }).pipe(
      map(response => response.data || [])
    );
  }

  unassignOrders(orderUids: string[]): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/assignments/delete`, { data: orderUids }).pipe(
      map(() => undefined)
    );
  }

  getMyAssignments(page: number = 1, count: number = 20): Observable<{ orders: CrmMyAssignedOrder[], total: number }> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());
    return this.http.get<ApiResponse<CrmMyAssignedOrder[]>>(`${this.baseUrl}/assignments/my`, { params }).pipe(
      map(response => ({
        orders: response.data || [],
        total: response.metadata?.total || 0
      }))
    );
  }

  // ============= Activities =============

  getActivityTimeline(orderUid: string, page: number = 1, count: number = 20): Observable<{ activities: CrmActivity[], total: number }> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());
    return this.http.get<ApiResponse<CrmActivity[]>>(`${this.baseUrl}/activities/${orderUid}`, { params }).pipe(
      map(response => ({
        activities: response.data || [],
        total: response.metadata?.total || 0
      }))
    );
  }

  createActivity(request: CrmCreateActivityRequest): Observable<{ uid: string }> {
    return this.http.post<ApiResponse<{ uid: string }>>(`${this.baseUrl}/activities`, { data: request }).pipe(
      map(response => response.data || { uid: '' })
    );
  }

  deleteActivity(uid: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/activities/${uid}`).pipe(
      map(() => undefined)
    );
  }

  deleteActivities(uids: string[]): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/activities/delete`, { data: uids }).pipe(
      map(() => undefined)
    );
  }

  // ============= Tasks =============

  getTasks(page: number = 1, count: number = 20): Observable<CrmTaskListResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());
    return this.http.get<ApiResponse<CrmTask[]>>(`${this.baseUrl}/tasks`, { params }).pipe(
      map(response => ({
        tasks: response.data || [],
        total: response.metadata?.total || 0
      }))
    );
  }

  getMyTasks(page: number = 1, count: number = 20): Observable<CrmTaskListResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());
    return this.http.get<ApiResponse<CrmTask[]>>(`${this.baseUrl}/tasks/my`, { params }).pipe(
      map(response => ({
        tasks: response.data || [],
        total: response.metadata?.total || 0
      }))
    );
  }

  getOverdueTasks(page: number = 1, count: number = 20): Observable<CrmTaskListResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());
    return this.http.get<ApiResponse<CrmTask[]>>(`${this.baseUrl}/tasks/overdue`, { params }).pipe(
      map(response => ({
        tasks: response.data || [],
        total: response.metadata?.total || 0
      }))
    );
  }

  getTasksByOrder(orderUid: string, page: number = 1, count: number = 20): Observable<CrmTaskListResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('count', count.toString());
    return this.http.get<ApiResponse<CrmTask[]>>(`${this.baseUrl}/tasks/order/${orderUid}`, { params }).pipe(
      map(response => ({
        tasks: response.data || [],
        total: response.metadata?.total || 0
      }))
    );
  }

  getTask(uid: string): Observable<CrmTask> {
    return this.http.get<ApiResponse<CrmTask>>(`${this.baseUrl}/tasks/${uid}`).pipe(
      map(response => response.data)
    );
  }

  getTasksBatch(uids: string[]): Observable<CrmTask[]> {
    if (uids.length === 0) {
      return of([]);
    }
    return this.http.post<ApiResponse<CrmTask[]>>(`${this.baseUrl}/tasks/batch`, { data: uids }).pipe(
      map(response => response.data || [])
    );
  }

  createTask(request: CrmCreateTaskRequest): Observable<{ uid: string }> {
    return this.http.post<ApiResponse<{ uid: string }>>(`${this.baseUrl}/tasks`, { data: request }).pipe(
      map(response => response.data || { uid: '' })
    );
  }

  updateTask(uid: string, request: CrmUpdateTaskRequest): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.baseUrl}/tasks/${uid}`, { data: request }).pipe(
      map(() => undefined)
    );
  }

  deleteTask(uid: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/tasks/${uid}`).pipe(
      map(() => undefined)
    );
  }

  deleteTasks(uids: string[]): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/tasks/delete`, { data: uids }).pipe(
      map(() => undefined)
    );
  }

  updateTaskStatus(uid: string, status: CrmTaskStatus): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/tasks/${uid}/status`, { data: { status } }).pipe(
      map(() => undefined)
    );
  }

  completeTask(uid: string): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/tasks/${uid}/complete`, {}).pipe(
      map(() => undefined)
    );
  }

  // ============= Dashboard & Analytics =============

  private buildFilterParams(filters?: CrmDashboardFilters): HttpParams {
    let params = new HttpParams();
    if (!filters) return params;

    if (filters.storeUid) {
      params = params.set('store_uid', filters.storeUid);
    }
    if (filters.dateFrom) {
      params = params.set('date_from', filters.dateFrom);
    }
    if (filters.dateTo) {
      params = params.set('date_to', filters.dateTo);
    }
    if (filters.assigneeUid) {
      params = params.set('assignee_uid', filters.assigneeUid);
    }
    return params;
  }

  getDashboard(filters?: CrmDashboardFilters): Observable<CrmDashboardStats> {
    const params = this.buildFilterParams(filters);
    return this.http.get<ApiResponse<CrmDashboardStats>>(`${this.baseUrl}/dashboard`, { params }).pipe(
      map(response => response.data || {
        pipeline_stats: [],
        workload_stats: [],
        task_stats: { total_pending: 0, total_in_progress: 0, total_overdue: 0, completed_today: 0, completed_week: 0 },
        recent_activity: []
      })
    );
  }

  getWorkload(filters?: CrmDashboardFilters): Observable<CrmWorkloadStats[]> {
    const params = this.buildFilterParams(filters);
    return this.http.get<ApiResponse<CrmWorkloadStats[]>>(`${this.baseUrl}/workload`, { params }).pipe(
      map(response => response.data || [])
    );
  }

  getPipelineStats(filters?: CrmDashboardFilters): Observable<CrmPipelineStageStats[]> {
    const params = this.buildFilterParams(filters);
    return this.http.get<ApiResponse<CrmPipelineStageStats[]>>(`${this.baseUrl}/pipeline-stats`, { params }).pipe(
      map(response => response.data || [])
    );
  }

  getTaskStats(filters?: CrmDashboardFilters): Observable<CrmTaskStats> {
    const params = this.buildFilterParams(filters);
    return this.http.get<ApiResponse<CrmTaskStats>>(`${this.baseUrl}/task-stats`, { params }).pipe(
      map(response => response.data || { total_pending: 0, total_in_progress: 0, total_overdue: 0, completed_today: 0, completed_week: 0 })
    );
  }

  // ============= Users (for assignment) =============

  getAssignableUsers(storeUid?: string): Observable<CrmAssignableUser[]> {
    let params = new HttpParams();
    if (storeUid) {
      params = params.set('store_uid', storeUid);
    }
    return this.http.get<ApiResponse<CrmAssignableUser[]>>(`${this.baseUrl}/users`, { params }).pipe(
      map(response => response.data || [])
    );
  }

  // ============= Board Changes (Polling) =============

  checkForChanges(since: string, storeUid?: string): Observable<CrmBoardChanges> {
    let params = new HttpParams().set('since', since);
    if (storeUid) {
      params = params.set('store_uid', storeUid);
    }
    return this.http.get<ApiResponse<CrmBoardChanges>>(`${this.baseUrl}/board/changes`, { params }).pipe(
      map(response => response.data || { last_change_at: '', has_changes: false, affected_stages: [], change_count: 0 })
    );
  }
}

export interface CrmAssignableUser {
  uid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface CrmBoardChanges {
  last_change_at: string;
  has_changes: boolean;
  affected_stages: string[];
  change_count: number;
}
