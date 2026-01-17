import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CrmRoutingModule } from './crm-routing.module';
import { CrmComponent } from './crm.component';
import { PipelineBoardComponent } from './components/pipeline-board/pipeline-board.component';
import { OrderCardComponent } from './components/order-card/order-card.component';
import { AssignmentModalComponent } from './components/assignment-modal/assignment-modal.component';
import { ActivityTimelineComponent } from './components/activity-timeline/activity-timeline.component';
import { TaskListComponent } from './components/task-list/task-list.component';
import { DashboardFiltersComponent } from './components/dashboard-filters/dashboard-filters.component';
import { CrmSettingsComponent } from './pages/settings/crm-settings.component';
import { MyTasksComponent } from './pages/my-tasks/my-tasks.component';
import { CrmDashboardComponent } from './pages/dashboard/crm-dashboard.component';
import { WorkloadComponent } from './pages/workload/workload.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    CrmComponent,
    PipelineBoardComponent,
    OrderCardComponent,
    AssignmentModalComponent,
    ActivityTimelineComponent,
    TaskListComponent,
    DashboardFiltersComponent,
    CrmSettingsComponent,
    MyTasksComponent,
    CrmDashboardComponent,
    WorkloadComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    CrmRoutingModule,
    SharedModule
  ]
})
export class CrmModule { }
