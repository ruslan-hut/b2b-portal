import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AdminService, TableInfo, TableRecord, TableRecordsResponse } from '../../core/services/admin.service';
import { PageTitleService } from '../../core/services/page-title.service';

@Component({
    selector: 'app-tables',
    templateUrl: './tables.component.html',
    styleUrls: ['./tables.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TablesComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  tables: TableInfo[] = [];
  selectedTable = '';
  records: TableRecord[] = [];
  columns: string[] = [];
  loading = false;
  loadingRecords = false;
  error: string | null = null;
  
  // Pagination
  currentPage = 1;
  pageSize = 50;
  total = 0;
  totalPages = 1;
  
  // Search
  searchTerm = '';
  searchField = '';

  // Mobile UI state
  isControlsExpanded = false;
  expandedRecordIndices: Set<number> = new Set();

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef,
    private pageTitleService: PageTitleService
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle('Tables');
    this.loadTables();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadTables(): void {
    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.adminService.listTables().subscribe({
        next: (tables) => {
          this.tables = tables;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load tables:', err);
          this.error = 'Failed to load database tables';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  selectTable(table: TableInfo): void {
    this.selectedTable = table.name;
    this.currentPage = 1;
    this.searchTerm = '';
    this.searchField = '';
    this.columns = [];
    this.records = [];
    this.loadTableRecords();
  }

  onTableSelect(tableName: string): void {
    const table = this.tables.find(t => t.name === tableName);
    if (table) {
      this.selectTable(table);
    }
  }

  loadTableRecords(): void {
    if (!this.selectedTable) {
      return;
    }

    this.loadingRecords = true;
    this.error = null;

    this.subscriptions.add(
      this.adminService.searchTableRecords(
        this.selectedTable,
        this.currentPage,
        this.pageSize,
        this.searchTerm || undefined,
        this.searchField || undefined
      ).subscribe({
        next: (response: TableRecordsResponse) => {
          const data = response.data || [];
          this.records = [...data];
          this.total = response.pagination?.total || data.length;
          this.totalPages = response.pagination?.total_pages || Math.ceil(this.total / this.pageSize);

          // Extract column names from first record
          if (data.length > 0) {
            this.columns = [...Object.keys(data[0])];
          } else {
            this.columns = [];
          }

          this.loadingRecords = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load table records:', err);
          this.error = 'Failed to load table records';
          this.loadingRecords = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.loadTableRecords();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadTableRecords();
    }
  }

  formatValue(value: any, column?: string): string {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    // Format percentage fields
    if (column && this.isPercentageColumn(column)) {
      return `${value}%`;
    }

    // Format currency/money fields
    if (column && this.isMoneyColumn(column)) {
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      if (!isNaN(numValue)) {
        return (numValue / 100).toFixed(2);
      }
    }

    return String(value);
  }

  getValueClass(value: any, column?: string): string {
    if (value === null || value === undefined) {
      return 'value-null';
    }
    if (typeof value === 'number') {
      return 'value-number';
    }
    if (typeof value === 'boolean') {
      return 'value-boolean';
    }

    // Special class for percentage columns
    if (column && this.isPercentageColumn(column)) {
      return 'value-percentage';
    }

    // Special class for money columns
    if (column && this.isMoneyColumn(column)) {
      return 'value-money';
    }

    return 'value-text';
  }

  private isPercentageColumn(column: string): boolean {
    const percentageColumns = [
      'discount',
      'discount_percent',
      'vat_rate',
      'default_vat_rate'
    ];
    return percentageColumns.includes(column.toLowerCase());
  }

  private isMoneyColumn(column: string): boolean {
    const moneyColumns = [
      'price',
      'total',
      'subtotal',
      'total_vat',
      'tax',
      'price_discount',
      'value'
    ];
    return moneyColumns.includes(column.toLowerCase());
  }

  getColumnLabel(column: string): string {
    // Convert snake_case to Title Case with better labels
    const labels: { [key: string]: string } = {
      'vat_rate': 'VAT Rate (%)',
      'vat_number': 'VAT Number',
      'default_vat_rate': 'Default VAT Rate (%)',
      'discount_percent': 'Discount (%)',
      'price_discount': 'Price (Discounted)',
      'total_vat': 'Total VAT',
      'subtotal': 'Subtotal (Net)',
      'tax': 'VAT Amount'
    };

    if (labels[column.toLowerCase()]) {
      return labels[column.toLowerCase()];
    }

    // Default: Convert snake_case to Title Case
    return column
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Mobile UI methods
  toggleControls(): void {
    this.isControlsExpanded = !this.isControlsExpanded;
  }

  toggleRecordExpanded(index: number): void {
    if (this.expandedRecordIndices.has(index)) {
      this.expandedRecordIndices.delete(index);
    } else {
      this.expandedRecordIndices.add(index);
    }
  }

  isRecordExpanded(index: number): boolean {
    return this.expandedRecordIndices.has(index);
  }

  // Get preview columns (first 2-3 important columns for card summary)
  getPreviewColumns(): string[] {
    // Prioritize uid/id columns, then name columns, then take first few
    const priorityOrder = ['uid', 'id', 'name', 'username', 'email', 'title', 'sku'];
    const preview: string[] = [];

    // First, add priority columns that exist
    for (const col of priorityOrder) {
      if (this.columns.includes(col) && preview.length < 3) {
        preview.push(col);
      }
    }

    // Then fill up to 3 with remaining columns
    for (const col of this.columns) {
      if (!preview.includes(col) && preview.length < 3) {
        preview.push(col);
      }
    }

    return preview;
  }

  // Get remaining columns (for expanded view)
  getRemainingColumns(): string[] {
    const preview = this.getPreviewColumns();
    return this.columns.filter(col => !preview.includes(col));
  }

  // Get the primary identifier for a record (for card title)
  getRecordTitle(record: TableRecord): string {
    // Try common identifier columns
    const titleColumns = ['name', 'username', 'title', 'uid', 'id', 'email', 'sku'];
    for (const col of titleColumns) {
      if (record[col] !== undefined && record[col] !== null) {
        return this.formatValue(record[col], col);
      }
    }
    // Fallback to first column value
    if (this.columns.length > 0) {
      return this.formatValue(record[this.columns[0]], this.columns[0]);
    }
    return 'Record';
  }
}

