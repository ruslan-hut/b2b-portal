import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CartAddress } from '../../core/models/order.model';
import { ClientAddress } from '../../core/models/app-settings.model';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-cart-address',
    templateUrl: './cart-address.component.html',
    styleUrls: ['./cart-address.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartAddressComponent implements OnInit, OnDestroy {
  @Input() address: CartAddress | null = null;
  @Input() isDraft: boolean = true; // Address can only be changed for draft orders
  @Output() addressChange = new EventEmitter<string>(); // Emits address UID when changed

  showAddressDialog = false;
  addresses: ClientAddress[] = [];
  loadingAddresses = false;

  private subscription = new Subscription();

  constructor(private appSettingsService: AppSettingsService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Subscribe to AppSettings changes for addresses
    this.subscription.add(
      this.appSettingsService.settings$.subscribe(settings => {
        if (settings?.addresses) {
          this.addresses = settings.addresses;
        } else {
          this.addresses = [];
        }
        this.loadingAddresses = false;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /**
   * Open address selection dialog
   */
  openAddressDialog(): void {
    if (!this.isDraft) return;
    this.showAddressDialog = true;
  }

  /**
   * Close address selection dialog
   */
  closeAddressDialog(): void {
    this.showAddressDialog = false;
  }

  /**
   * Handle address selection from dialog
   */
  selectAddress(address: ClientAddress): void {
    this.addressChange.emit(address.uid);
    this.closeAddressDialog();
  }

  /**
   * Get formatted address for compact display
   */
  getCompactAddress(): string {
    if (!this.address) {
      return '';
    }
    const parts: string[] = [];
    if (this.address.city) {
      parts.push(this.address.city);
    }
    if (this.address.country_name) {
      parts.push(this.address.country_name);
    } else if (this.address.country_code) {
      parts.push(this.address.country_code);
    }
    return parts.join(', ');
  }

  /**
   * Check if current address is the selected one
   */
  isSelected(addr: ClientAddress): boolean {
    return this.address?.uid === addr.uid;
  }
}
