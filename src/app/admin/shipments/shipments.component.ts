import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { PageTitleService } from '../../core/services/page-title.service';

@Component({
  selector: 'app-shipments',
  templateUrl: './shipments.component.html',
  styleUrls: ['./shipments.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShipmentsComponent implements OnInit {
  constructor(private pageTitleService: PageTitleService) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle('Shipments');
  }
}
