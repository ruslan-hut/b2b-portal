import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PartnersRoutingModule } from './partners-routing.module';
import { HubComponent } from './hub/hub.component';
import { PartnerPageComponent } from './page/page.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [HubComponent, PartnerPageComponent],
  imports: [CommonModule, FormsModule, PartnersRoutingModule, SharedModule]
})
export class PartnersModule {}
