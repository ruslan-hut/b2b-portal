import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { MenuItem } from '../../../../shared/components/menu-bar/menu-bar.component';
import { TranslationService } from '../../../../core/services/translation.service';

@Component({
    selector: 'app-crm-nav',
    templateUrl: './crm-nav.component.html',
    styleUrl: './crm-nav.component.scss',
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CrmNavComponent implements OnInit {
  menuItems: MenuItem[] = [];

  constructor(private translationService: TranslationService) {}

  ngOnInit(): void {
    this.menuItems = [
      { icon: 'view_kanban', label: this.translationService.instant('admin.crm.pipeline'), route: '/admin/crm', exactMatch: true },
      { icon: 'dashboard', label: this.translationService.instant('admin.crm.dashboard'), route: '/admin/crm/dashboard' },
      { icon: 'bar_chart', label: this.translationService.instant('admin.crm.workload'), route: '/admin/crm/workload' },
      { icon: 'task_alt', label: this.translationService.instant('admin.crm.myTasks'), route: '/admin/crm/my-tasks' },
      { icon: 'settings', label: this.translationService.instant('common.settings'), route: '/admin/crm/settings' }
    ];
  }
}
