import { TestBed } from '@angular/core/testing';
import { ErrorHandlerService, OrderErrorType } from './error-handler.service';
import { TranslationService } from './translation.service';

/** Builds the HttpErrorResponse shape the backend actually produces. */
function httpError(status: number, detail: any): any {
  return { status, error: { success: false, error: detail } };
}

describe('ErrorHandlerService', () => {
  let service: ErrorHandlerService;

  beforeEach(() => {
    const translation = jasmine.createSpyObj<TranslationService>('TranslationService', ['instant']);
    // Echo the key back so assertions read against the key, not the copy.
    translation.instant.and.callFake((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        ErrorHandlerService,
        { provide: TranslationService, useValue: translation }
      ]
    });
    service = TestBed.inject(ErrorHandlerService);
  });

  it('renders a problem list when the backend aggregates per-product faults', () => {
    const detail = service.getOrderErrorDetail(httpError(422, {
      code: 'VALIDATION_ERROR',
      message: 'Order has problem items',
      details: { reason: 'validation' },
      extra: {
        problems: [
          { product_uid: 'p1', sku: 'SKU-1', reason: 'not_found' },
          { product_uid: 'p2', sku: 'SKU-2', reason: 'no_price' }
        ]
      }
    }));

    expect(detail.type).toBe(OrderErrorType.VALIDATION_PROBLEMS);
    expect(detail.problems.length).toBe(2);
    expect(detail.problems[0].reason).toBe('not_found');
    expect(detail.problems[1].reason).toBe('no_price');
  });

  // The reported bug: a missing draft order came back as a bare 404 whose
  // message contained "not found", and the UI announced "Product not found."
  it('does not report a missing draft order as a missing product', () => {
    const detail = service.getOrderErrorDetail(httpError(404, {
      code: 'NOT_FOUND',
      message: 'Order not found',
      details: { reason: 'draft_not_found' }
    }));

    expect(detail.type).toBe(OrderErrorType.CART_EXPIRED);
    expect(detail.message).toBe('errors.cartExpired');
  });

  it('does not report an unlabelled 404 as a missing product', () => {
    const detail = service.getOrderErrorDetail(httpError(404, {
      code: 'NOT_FOUND',
      message: 'Price type not found'
    }));

    expect(detail.type).toBe(OrderErrorType.UNKNOWN);
    expect(detail.message).toBe('errors.orderFailed');
  });

  it('classifies business registration by reason, not by message prose', () => {
    const detail = service.getOrderErrorDetail(httpError(422, {
      code: 'VALIDATION_ERROR',
      message: 'Business registration number required',
      details: { reason: 'business_registration_required' }
    }));

    expect(detail.type).toBe(OrderErrorType.BUSINESS_REG_NUMBER_REQUIRED);
  });

  it('classifies insufficient stock by reason', () => {
    const detail = service.getOrderErrorDetail(httpError(422, {
      code: 'VALIDATION_ERROR',
      message: 'order 12: insufficient stock',
      details: { reason: 'insufficient_stock' }
    }));

    expect(detail.type).toBe(OrderErrorType.INSUFFICIENT_STOCK);
  });

  it('falls back to prose only for a genuine product-not-found message', () => {
    const detail = service.getOrderErrorDetail(httpError(500, {
      code: 'INTERNAL_ERROR',
      message: 'product not found'
    }));

    expect(detail.type).toBe(OrderErrorType.PRODUCT_NOT_FOUND);
  });

  it('treats a connection failure as a network error', () => {
    expect(service.getOrderErrorDetail({ status: 0 }).type).toBe(OrderErrorType.NETWORK_ERROR);
  });
});
