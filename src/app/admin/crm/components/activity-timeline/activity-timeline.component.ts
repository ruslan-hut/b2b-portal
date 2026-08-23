import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CrmService } from "../../services/crm.service";
import {
  CrmActivity,
  CrmActivityType,
  CrmCreateActivityRequest,
  CrmStageChangeMetadata,
  CrmAssignmentMetadata,
  CrmOrderFieldChangeMetadata,
  CrmItemChangeMetadata,
  CrmTotalChangeMetadata,
} from "../../models/crm-activity.model";
import { formatDateShort } from "../../../../core/utils/date-format";
import { TranslationService } from "../../../../core/services/translation.service";
import { ConfirmDialogService } from "../../../../core/services/confirm-dialog.service";
import { PriceFormattingService } from "../../../../core/services/price-formatting.service";

@Component({
  selector: "app-activity-timeline",
  templateUrl: "./activity-timeline.component.html",
  styleUrls: ["./activity-timeline.component.scss"],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityTimelineComponent implements OnInit {
  private readonly crmService = inject(CrmService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translationService = inject(TranslationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly priceFormatting = inject(PriceFormattingService);

  readonly orderUid = input.required<string>();
  readonly currencyCode = input<string>("USD");

  activities: CrmActivity[] = [];
  totalActivities = 0;
  loading = false;
  saving = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 20;

  // Add note form
  newNoteContent = "";
  newNoteIsInternal = false;
  showAddNoteForm = false;

  ngOnInit(): void {
    this.loadActivities();
  }

  loadActivities(): void {
    const orderUid = this.orderUid();
    if (!orderUid) return;

    this.loading = true;
    this.error = null;

    this.crmService
      .getActivityTimeline(orderUid, this.currentPage, this.pageSize)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.activities = response.activities;
          this.totalActivities = response.total;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error("Failed to load activities:", err);
          this.error = "Failed to load activity timeline";
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  toggleAddNoteForm(): void {
    this.showAddNoteForm = !this.showAddNoteForm;
    if (!this.showAddNoteForm) {
      this.newNoteContent = "";
      this.newNoteIsInternal = false;
    }
  }

  addNote(): void {
    if (!this.newNoteContent.trim()) {
      this.error = "Note content cannot be empty";
      return;
    }

    this.saving = true;
    this.error = null;

    const request: CrmCreateActivityRequest = {
      order_uid: this.orderUid(),
      activity_type: "note",
      content: this.newNoteContent.trim(),
      is_internal: this.newNoteIsInternal,
    };

    this.crmService.createActivity(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.newNoteContent = "";
          this.newNoteIsInternal = false;
          this.showAddNoteForm = false;
          this.saving = false;
          this.currentPage = 1;
          this.loadActivities();
        },
        error: (err) => {
          console.error("Failed to add note:", err);
          this.error = "Failed to add note";
          this.saving = false;
          this.cdr.markForCheck();
        },
      });
  }

  async deleteActivity(uid: string): Promise<void> {
    if (!await this.confirmDialog.ask({ message: this.translationService.instant("admin.crm.deleteConfirm"), danger: true })) {
      return;
    }

    this.crmService.deleteActivity(uid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadActivities();
        },
        error: (err) => {
          console.error("Failed to delete activity:", err);
          this.error = "Failed to delete activity";
          this.cdr.markForCheck();
        },
      });
  }

  loadMore(): void {
    if (this.activities.length < this.totalActivities) {
      this.currentPage++;
      this.loading = true;

      this.crmService
        .getActivityTimeline(this.orderUid(), this.currentPage, this.pageSize)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            this.activities = [...this.activities, ...response.activities];
            this.loading = false;
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.error("Failed to load more activities:", err);
            this.currentPage--;
            this.loading = false;
            this.cdr.markForCheck();
          },
        });
    }
  }

  getActivityIcon(type: CrmActivityType): string {
    const icons: Record<CrmActivityType, string> = {
      note: "note",
      comment: "chat",
      stage_change: "swap_horiz",
      assignment: "person_add",
      unassignment: "person_remove",
      order_created: "add_shopping_cart",
      status_change: "published_with_changes",
      order_edit: "edit",
      items_changed: "inventory",
      total_changed: "payments",
      discount_changed: "percent",
    };
    return icons[type] || "info";
  }

  getActivityTypeLabel(type: CrmActivityType): string {
    const keys: Record<CrmActivityType, string> = {
      note: "admin.crm.activityNote",
      comment: "admin.crm.activityComment",
      stage_change: "admin.crm.activityStageChange",
      assignment: "admin.crm.activityAssignment",
      unassignment: "admin.crm.activityUnassignment",
      order_created: "admin.crm.activityOrderCreated",
      status_change: "admin.crm.activityStatusChange",
      order_edit: "admin.crm.activityOrderEdit",
      items_changed: "admin.crm.activityItemsChanged",
      total_changed: "admin.crm.activityTotalChanged",
      discount_changed: "admin.crm.activityDiscountChanged",
    };
    const key = keys[type];
    return key ? this.translationService.instant(key) : type;
  }

  getActivityColor(type: CrmActivityType): string {
    const colors: Record<CrmActivityType, string> = {
      note: "#6366f1",
      comment: "#0ea5e9",
      stage_change: "#8b5cf6",
      assignment: "#10b981",
      unassignment: "#f59e0b",
      order_created: "#22c55e",
      status_change: "#ec4899",
      order_edit: "#f97316",
      items_changed: "#06b6d4",
      total_changed: "#84cc16",
      discount_changed: "#a855f7",
    };
    return colors[type] || "#64748b";
  }

  formatDateTime(dateString: string): string {
    return formatDateShort(dateString);
  }

  formatRelativeTime(dateString: string): string {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1)
      return this.translationService.instant("admin.crm.justNow");
    if (diffMins < 60)
      return this.translationService.instant("admin.crm.minutesAgo", {
        count: diffMins,
      });
    if (diffHours < 24)
      return this.translationService.instant("admin.crm.hoursAgo", {
        count: diffHours,
      });
    if (diffDays < 7)
      return this.translationService.instant("admin.crm.daysAgo", {
        count: diffDays,
      });
    return this.formatDateTime(dateString);
  }

  getStageChangeDescription(activity: CrmActivity): string {
    const metadata = activity.metadata as CrmStageChangeMetadata | undefined;
    if (!metadata)
      return this.translationService.instant("admin.crm.activityStageDefault");

    const unknown = this.translationService.instant("admin.crm.unknown");
    const from = metadata.from_stage_name || unknown;
    const to = metadata.to_stage_name || unknown;
    return `${from} → ${to}`;
  }

  private static readonly SOURCE_LABELS: Record<string, string> = {
    user: "User",
    erp: "ERP",
    invoice_auto: "Invoice (auto)",
    system: "System",
  };

  // Actor shown on a stage change: the acting user's name, or — when no
  // interactive user is responsible — the humanized source tag (ERP, System…).
  getStageChangeActor(activity: CrmActivity): string {
    if (activity.user_name) return activity.user_name;
    const metadata = activity.metadata as CrmStageChangeMetadata | undefined;
    if (metadata?.actor_name) return metadata.actor_name;
    const source = metadata?.source;
    if (source) return ActivityTimelineComponent.SOURCE_LABELS[source] || source;
    return "";
  }

  getAssignmentDescription(activity: CrmActivity): string {
    const metadata = activity.metadata as CrmAssignmentMetadata | undefined;
    if (!metadata) {
      return activity.activity_type === "assignment"
        ? this.translationService.instant("admin.crm.activityAssignDefault")
        : this.translationService.instant("admin.crm.activityUnassignDefault");
    }

    if (activity.activity_type === "assignment") {
      const assignedTo =
        metadata.assigned_to_name ||
        metadata.assigned_to_uid ||
        this.translationService.instant("admin.crm.unknown");
      return this.translationService.instant("admin.crm.activityAssignedTo", {
        name: assignedTo,
      });
    } else {
      const previousUser =
        metadata.previous_user_name ||
        metadata.previous_user_uid ||
        this.translationService.instant("admin.crm.unknown");
      return this.translationService.instant(
        "admin.crm.activityUnassignedFrom",
        { name: previousUser },
      );
    }
  }

  getOrderCreatedDescription(activity: CrmActivity): string {
    const metadata = activity.metadata as CrmAssignmentMetadata | undefined;
    const name = metadata?.assigned_to_name || metadata?.assigned_to_uid;
    if (!name) return "";
    return this.translationService.instant("admin.crm.activityAssignedTo", {
      name,
    });
  }

  getOrderEditDescription(activity: CrmActivity): string {
    const metadata = activity.metadata as
      | CrmOrderFieldChangeMetadata[]
      | undefined;
    if (!metadata || !Array.isArray(metadata) || metadata.length === 0) {
      return this.translationService.instant("admin.crm.activityFieldsUpdated");
    }

    if (metadata.length === 1) {
      const change = metadata[0];
      return this.formatFieldChange(change);
    }

    return (
      this.translationService.instant("admin.crm.activityFieldsUpdatedCount", {
        count: metadata.length,
      }) +
      ": " +
      metadata.map((c) => c.field_name).join(", ")
    );
  }

  getItemsChangedDescription(activity: CrmActivity): string {
    const metadata = activity.metadata as CrmItemChangeMetadata[] | undefined;
    if (!metadata || !Array.isArray(metadata) || metadata.length === 0) {
      return this.translationService.instant("admin.crm.activityItemsDefault");
    }

    const added = metadata.filter((m) => m.action === "added").length;
    const removed = metadata.filter((m) => m.action === "removed").length;
    const modified = metadata.filter((m) => m.action === "modified").length;

    const parts: string[] = [];
    if (added > 0)
      parts.push(
        `${added} ${this.translationService.instant("admin.crm.activityAdded")}`,
      );
    if (removed > 0)
      parts.push(
        `${removed} ${this.translationService.instant("admin.crm.activityRemoved")}`,
      );
    if (modified > 0)
      parts.push(
        `${modified} ${this.translationService.instant("admin.crm.activityModified")}`,
      );

    return parts.length > 0
      ? parts.join(", ")
      : this.translationService.instant("admin.crm.activityItemsDefault");
  }

  getTotalChangedDescription(activity: CrmActivity): string {
    const metadata = activity.metadata as CrmTotalChangeMetadata | undefined;
    if (!metadata)
      return this.translationService.instant("admin.crm.activityTotalDefault");

    const oldTotal = this.formatPrice(metadata.old_total);
    const newTotal = this.formatPrice(metadata.new_total);
    const totalLabel = this.translationService.instant(
      "admin.crm.activityTotal",
    );

    return `${totalLabel}: ${oldTotal} → ${newTotal}`;
  }

  getItemChangeDetails(changes: CrmItemChangeMetadata[]): string[] {
    return changes.map((change) => {
      const sku = change.sku || "";
      const name = change.product_name || "";
      const productLabel =
        sku && name && sku !== name
          ? `${sku}: ${name}`
          : name || sku || change.product_uid;
      switch (change.action) {
        case "added":
          return `+ ${productLabel} (qty: ${change.new_quantity})`;
        case "removed":
          return `- ${productLabel} (qty: ${change.old_quantity})`;
        case "modified":
          return `\u270E ${productLabel} (qty: ${change.old_quantity} \u2192 ${change.new_quantity})`;
        default:
          return productLabel;
      }
    });
  }

  private formatPrice(amountInCents: number): string {
    return this.priceFormatting.formatPriceWithCurrency(amountInCents, this.currencyCode() || "USD");
  }

  hasItemChangeDetails(activity: CrmActivity): boolean {
    return (
      activity.metadata != null &&
      Array.isArray(activity.metadata) &&
      activity.metadata.length > 0
    );
  }

  getItemChangeDetailsArray(activity: CrmActivity): string[] {
    if (!this.hasItemChangeDetails(activity)) {
      return [];
    }
    return this.getItemChangeDetails(
      activity.metadata as CrmItemChangeMetadata[],
    );
  }

  private static readonly MONEY_FIELDS = new Set(["delivery_cost"]);

  private formatFieldValue(field: string, value: any): string {
    if (ActivityTimelineComponent.MONEY_FIELDS.has(field)) {
      const num = typeof value === "number" ? value : Number(value);
      if (!Number.isNaN(num)) {
        return this.formatPrice(num);
      }
    }
    return String(value);
  }

  private formatFieldChange(change: CrmOrderFieldChangeMetadata): string {
    const fieldName = this.formatFieldName(change.field_name);
    const newValue = this.formatFieldValue(change.field_name, change.new_value);
    if (
      change.old_value === undefined ||
      change.old_value === null ||
      change.old_value === "" ||
      change.old_value === 0
    ) {
      return this.translationService.instant("admin.crm.activityFieldSetTo", {
        field: fieldName,
        value: newValue,
      });
    }
    const oldValue = this.formatFieldValue(change.field_name, change.old_value);
    return `${fieldName}: ${oldValue} → ${newValue}`;
  }

  private formatFieldName(fieldName: string): string {
    return fieldName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  canDelete(activity: CrmActivity): boolean {
    // Only allow deleting notes and comments
    return (
      activity.activity_type === "note" || activity.activity_type === "comment"
    );
  }

  get hasMoreActivities(): boolean {
    return this.activities.length < this.totalActivities;
  }
}
