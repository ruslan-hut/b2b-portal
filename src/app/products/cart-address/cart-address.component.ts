import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CartAddress } from '../../core/models/order.model';
import { ClientAddress, ClientBranch } from '../../core/models/app-settings.model';
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
  // Branches of the client, read-only. An address linked to one is billed to it,
  // so an inactive branch makes that address unusable for a new order.
  branches: ClientBranch[] = [];
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
        this.branches = settings?.branches || [];
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
   * Handle address selection from dialog. An address whose branch is inactive is
   * refused here rather than at confirm time: the order would be rejected by the
   * backend anyway, and only after the client had finished checking out.
   */
  selectAddress(address: ClientAddress): void {
    if (this.isAddressBlocked(address)) return;
    this.addressChange.emit(address.uid);
    this.closeAddressDialog();
  }

  /**
   * Name of the branch an address is billed to, or '' when it is billed to the
   * account directly. A branch_uid with no matching branch also returns '' —
   * the branch list is filtered by the backend, nothing to name.
   */
  branchName(address: ClientAddress): string {
    return this.branchFor(address)?.name ?? '';
  }

  /** True when this address is billed to a branch the ERP has deactivated. */
  isAddressBlocked(address: ClientAddress): boolean {
    const branch = this.branchFor(address);
    return !!branch && !branch.active;
  }

  /** Branch of the address currently selected for the order, if it has one. */
  get selectedBranchName(): string {
    return this.address?.branch_name || '';
  }

  /** True when the address already on the order is billed to an inactive branch. */
  get selectedBranchInactive(): boolean {
    return !!this.address?.branch_uid && this.address.branch_active === false;
  }

  private branchFor(address: ClientAddress): ClientBranch | undefined {
    if (!address.branch_uid) return undefined;
    return this.branches.find(b => b.uid === address.branch_uid);
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
