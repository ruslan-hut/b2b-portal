import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { ApiGuideComponent } from './api-guide.component';
import { ApiGuideUkComponent } from './content/api-guide-uk.component';
import { ApiGuideEnComponent } from './content/api-guide-en.component';

const routes: Routes = [{ path: '', component: ApiGuideComponent }];

@NgModule({
  declarations: [ApiGuideComponent, ApiGuideUkComponent, ApiGuideEnComponent],
  imports: [SharedModule, RouterModule.forChild(routes)]
})
export class ApiGuideModule { }
