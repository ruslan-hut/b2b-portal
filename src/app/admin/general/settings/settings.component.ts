import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api.model';
import { BrandingService } from '../../../core/services/branding.service';
import { formatDateTime } from '../../../core/utils/date-format';

interface SiteSettings {
  id: number;
  site_name: string;
  site_url: string;
  created_at: string;
  last_update: string;
}

@Component({
  selector: 'app-general-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly branding = inject(BrandingService);
  private readonly apiUrl = environment.apiUrl;

  settings: SiteSettings | null = null;
  siteName = '';
  siteUrl = '';
  loading = false;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading = true;
    this.error = null;
    this.http.get<ApiResponse<SiteSettings>>(`${this.apiUrl}/admin/site/settings`).subscribe({
      next: (response) => {
        this.settings = response.data;
        this.siteName = response.data?.site_name ?? '';
        this.siteUrl = response.data?.site_url ?? '';
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load settings';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  refresh(): void {
    this.successMessage = null;
    this.loadSettings();
  }

  save(): void {
    const name = this.siteName.trim();
    if (!name) {
      this.error = 'Site name cannot be empty';
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.error = null;
    this.successMessage = null;
    this.http.put<ApiResponse<SiteSettings>>(
      `${this.apiUrl}/admin/site/settings`,
      { data: { site_name: name, site_url: this.siteUrl.trim() } }
    ).subscribe({
      next: (response) => {
        this.settings = response.data;
        this.siteName = response.data?.site_name ?? name;
        // The backend canonicalises the origin (drops any path, trims the
        // trailing slash), so take its value rather than what was typed.
        this.siteUrl = response.data?.site_url ?? '';
        // Apply immediately so the browser tab and header reflect the change.
        this.branding.setSiteName(this.siteName);
        this.successMessage = response.message || 'Settings updated successfully';
        this.saving = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to update settings';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  formatDate(value: string): string {
    return formatDateTime(value);
  }
}
