import { Component, OnInit } from '@angular/core';
import { AdminService, TableInfo, TableRecord, TableRecordsResponse } from '../../core/services/admin.service';

@Component({
  selector: 'app-tables',
  templateUrl: './tables.component.html',
  styleUrls: ['./tables.component.scss']
})
export class TablesComponent implements OnInit {
  tables: TableInfo[] = [];
  selectedTable: string | null = null;
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

  constructor(private adminService: AdminService) {}

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
      },
      error: (err) => {
        console.error('Failed to load tables:', err);
        this.error = 'Failed to load database tables';
        this.loading = false;
      }
    });
  }

  selectTable(table: TableInfo): void {
    this.selectedTable = table.name;
    this.currentPage = 1;
    this.searchTerm = '';
    this.loadTableRecords();
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
      this.searchTerm || undefined
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
      },
      error: (err) => {
        console.error('Failed to load table records:', err);
        this.error = 'Failed to load table records';
        this.loadingRecords = false;
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

  formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  getValueClass(value: any): string {
    if (value === null || value === undefined) {
      return 'value-null';
    }
    if (typeof value === 'number') {
      return 'value-number';
    }
    if (typeof value === 'boolean') {
      return 'value-boolean';
    }
    return 'value-text';
  }
}

