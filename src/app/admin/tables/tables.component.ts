import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { AdminService, TableInfo, TableRecord, TableRecordsResponse } from '../../core/services/admin.service';

@Component({
    selector: 'app-tables',
    templateUrl: './tables.component.html',
    styleUrls: ['./tables.component.scss'],
    standalone: false
})
export class TablesComponent implements OnInit {
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

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTables();
  }

  loadTables(): void {
    this.loading = true;
    this.error = null;

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
    });
  }

  selectTable(table: TableInfo): void {
    this.selectedTable = table.name;
    this.currentPage = 1;
    this.searchTerm = '';
    this.searchField = '';
    this.columns = [];
    this.records = [];
    this.cdr.detectChanges();
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

    this.adminService.searchTableRecords(
      this.selectedTable,
      this.currentPage,
      this.pageSize,
      this.searchTerm || undefined,
      this.searchField || undefined
    ).subscribe({
      next: (response: TableRecordsResponse) => {
        this.records = response.data || [];
        this.total = response.metadata?.total || this.records.length;
        this.totalPages = response.metadata?.total_pages || Math.ceil(this.total / this.pageSize);

        // Extract column names from first record
        if (this.records.length > 0) {
          this.columns = Object.keys(this.records[0]);
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
    });
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
}

