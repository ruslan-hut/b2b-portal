import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

/**
 * Presentational component for category headers in the product catalog
 * Displays category name with gradient text and decorative divider
 */
@Component({
  selector: 'app-category-header',
  standalone: false,
  templateUrl: './category-header.component.html',
  styleUrl: './category-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryHeaderComponent {
  /**
   * Category name to display
   */
  @Input({ required: true }) categoryName!: string;
}
