import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

export interface MenuItem {
  icon: string;
  label: string;
  route: string;
  exactMatch?: boolean;
}

@Component({
  selector: 'app-menu-bar',
  templateUrl: './menu-bar.component.html',
  styleUrl: './menu-bar.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MenuBarComponent {
  @Input() items: MenuItem[] = [];
}
