import { Injectable } from '@angular/core';
import { TranslationService } from './translation.service';

export enum OrderErrorType {
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  PRODUCT_INACTIVE = 'PRODUCT_INACTIVE',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  INVALID_STATUS = 'INVALID_STATUS',
  BUSINESS_REG_NUMBER_REQUIRED = 'BUSINESS_REG_NUMBER_REQUIRED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN'
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {
  constructor(private translationService: TranslationService) {}

  /**
   * Parse error and return user-friendly message
   */
  getOrderErrorMessage(error: any): string {
    const errorType = this.parseOrderError(error);

    switch (errorType) {
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

      case OrderErrorType.NETWORK_ERROR:
        return this.translationService.instant('errors.networkError');

      default:
        return this.translationService.instant('errors.orderFailed');
    }
  }

  /**
   * Parse error type from error object
   */
  private parseOrderError(error: any): OrderErrorType {
    const message = error?.message?.toLowerCase() || '';

    if (message.includes('insufficient stock') || message.includes('insufficient_stock')) {
      return OrderErrorType.INSUFFICIENT_STOCK;
    }

    if (message.includes('not active') || message.includes('product_inactive')) {
      return OrderErrorType.PRODUCT_INACTIVE;
    }

    if (message.includes('not found') || message.includes('product_not_found')) {
      return OrderErrorType.PRODUCT_NOT_FOUND;
    }

    if (message.includes('invalid status') || message.includes('invalid_status')) {
      return OrderErrorType.INVALID_STATUS;
    }

    if (message.includes('business registration number required')) {
      return OrderErrorType.BUSINESS_REG_NUMBER_REQUIRED;
    }

    if (message.includes('network') || error?.status === 0) {
      return OrderErrorType.NETWORK_ERROR;
    }

    return OrderErrorType.UNKNOWN;
  }
}
