import { Injectable } from '@angular/core';
import { TranslationService } from './translation.service';

export enum OrderErrorType {
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  PRODUCT_INACTIVE = 'PRODUCT_INACTIVE',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  INVALID_STATUS = 'INVALID_STATUS',
  BUSINESS_REG_NUMBER_REQUIRED = 'BUSINESS_REG_NUMBER_REQUIRED',
  CART_EXPIRED = 'CART_EXPIRED',
  BRANCH_INACTIVE = 'BRANCH_INACTIVE',
  BRANCH_INVALID = 'BRANCH_INVALID',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_PROBLEMS = 'VALIDATION_PROBLEMS',
  UNKNOWN = 'UNKNOWN'
}

export type OrderProblemReason = 'inactive' | 'insufficient_stock' | 'not_found' | 'no_price' | 'not_available';

export interface OrderProblem {
  productUid: string;
  sku: string;
  name: string;
  reason: OrderProblemReason;
  available?: number;
  requested?: number;
}

export interface OrderErrorDetail {
  type: OrderErrorType;
  message: string;
  problems: OrderProblem[];
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {
  constructor(private translationService: TranslationService) {}

  /**
   * Parse error and return user-friendly message (legacy single-line API).
   * Prefer getOrderErrorDetail for richer dialogs.
   */
  getOrderErrorMessage(error: any): string {
    return this.getOrderErrorDetail(error).message;
  }

  /**
   * Parse the structured error returned by the backend order endpoints.
   * Reads aggregated `details.extra.problems` when available; falls back to
   * the legacy string-based parsing for non-validation errors.
   */
  getOrderErrorDetail(error: any): OrderErrorDetail {
    const problems = this.extractProblems(error);
    if (problems.length > 0) {
      return {
        type: OrderErrorType.VALIDATION_PROBLEMS,
        message: this.translationService.instant('errors.order.problemsHeader', { count: problems.length }),
        problems
      };
    }

    const type = this.parseOrderError(error);
    const branch = this.errorDetail(error)?.details?.branch ?? '';
    return { type, message: this.messageForType(type, branch), problems: [] };
  }

  /** The backend ErrorDetail: { code, message, details, extra }. */
  private errorDetail(error: any): any {
    return error?.error?.error ?? error?.error ?? {};
  }

  private extractProblems(error: any): OrderProblem[] {
    const list = this.errorDetail(error)?.extra?.problems;
    if (!Array.isArray(list)) return [];
    const known: OrderProblemReason[] = ['inactive', 'insufficient_stock', 'not_found', 'no_price', 'not_available'];
    return list.map((p: any): OrderProblem => ({
      productUid: p.product_uid ?? p.productUid ?? '',
      sku: p.sku ?? '',
      name: p.name ?? '',
      reason: known.includes(p.reason) ? p.reason : 'inactive',
      available: p.available,
      requested: p.requested
    }));
  }

  /**
   * Prose for a classified error. `branch` names the legal entity a branch
   * failure is about; it is empty for every other type.
   */
  private messageForType(type: OrderErrorType, branch = ''): string {
    switch (type) {
      case OrderErrorType.BRANCH_INACTIVE:
        return branch
          ? this.translationService.instant('errors.branchInactive', { branch })
          : this.translationService.instant('errors.branchInactiveNoName');
      case OrderErrorType.BRANCH_INVALID:
        return this.translationService.instant('errors.branchInvalid');
      case OrderErrorType.INSUFFICIENT_STOCK:
        return this.translationService.instant('errors.insufficientStock');
      case OrderErrorType.PRODUCT_INACTIVE:
        return this.translationService.instant('errors.productInactive');
      case OrderErrorType.PRODUCT_NOT_FOUND:
        return this.translationService.instant('errors.productNotFound');
      case OrderErrorType.INVALID_STATUS:
        return this.translationService.instant('errors.invalidStatus');
      case OrderErrorType.BUSINESS_REG_NUMBER_REQUIRED:
        return this.translationService.instant('errors.businessRegNumberRequired');
      case OrderErrorType.CART_EXPIRED:
        return this.translationService.instant('errors.cartExpired');
      case OrderErrorType.NETWORK_ERROR:
        return this.translationService.instant('errors.networkError');
      default:
        return this.translationService.instant('errors.orderFailed');
    }
  }

  /**
   * Classify a non-problem-list error. The backend's machine-readable `code`
   * and `details.reason` decide the outcome; message prose is only consulted
   * as a last resort, for endpoints that predate the structured contract.
   *
   * Never widen the prose fallbacks. A bare `message.includes('not found')`
   * used to relabel every 404 — a missing draft order, client or price type —
   * as "Product not found.", which is what the client saw on order confirm.
   */
  private parseOrderError(error: any): OrderErrorType {
    if (error?.status === 0) {
      return OrderErrorType.NETWORK_ERROR;
    }

    const detail = this.errorDetail(error);
    const code = (detail?.code ?? '').toUpperCase();
    const reason = (detail?.details?.reason ?? '').toLowerCase();

    switch (reason) {
      case 'business_registration_required':
        return OrderErrorType.BUSINESS_REG_NUMBER_REQUIRED;
      case 'insufficient_stock':
        return OrderErrorType.INSUFFICIENT_STOCK;
      case 'inactive_product':
        return OrderErrorType.PRODUCT_INACTIVE;
      case 'draft_not_found':
        return OrderErrorType.CART_EXPIRED;
      case 'branch_inactive':
        return OrderErrorType.BRANCH_INACTIVE;
      // Missing, foreign or otherwise unbillable: all the client can do is pick
      // another address or call us, so they share one message.
      case 'branch_missing':
      case 'branch_foreign':
      case 'branch_invalid':
        return OrderErrorType.BRANCH_INVALID;
    }

    // A NOT_FOUND with no reason names some resource other than a product —
    // the product cases all arrive as a problem list. Don't guess.
    if (code === 'NOT_FOUND') {
      return OrderErrorType.UNKNOWN;
    }

    return this.parseLegacyOrderError(detail?.message ?? error?.message ?? '');
  }

  /** Prose matching for endpoints not yet emitting `code`/`details.reason`. */
  private parseLegacyOrderError(message: string): OrderErrorType {
    const serverMsg = message.toLowerCase();

    if (serverMsg.includes('not active') || serverMsg.includes('product_inactive')) {
      return OrderErrorType.PRODUCT_INACTIVE;
    }
    if (serverMsg.includes('insufficient stock') || serverMsg.includes('insufficient_stock')) {
      return OrderErrorType.INSUFFICIENT_STOCK;
    }
    if (serverMsg.includes('product not found') || serverMsg.includes('product_not_found')) {
      return OrderErrorType.PRODUCT_NOT_FOUND;
    }
    if (serverMsg.includes('invalid status') || serverMsg.includes('invalid_status')) {
      return OrderErrorType.INVALID_STATUS;
    }
    if (serverMsg.includes('business registration number required')) {
      return OrderErrorType.BUSINESS_REG_NUMBER_REQUIRED;
    }
    if (serverMsg.includes('network')) {
      return OrderErrorType.NETWORK_ERROR;
    }
    return OrderErrorType.UNKNOWN;
  }
}
