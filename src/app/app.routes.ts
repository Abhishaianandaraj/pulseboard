import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { MyDayComponent } from './pages/my-day/my-day.component';
import { WorkspaceComponent } from './pages/workspace/workspace.component';
import { ProjectsComponent } from './pages/projects/projects.component';
import { GovernanceComponent } from './pages/governance/governance.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'my-day',
    component: MyDayComponent,
    canActivate: [authGuard]
  },
  {
    path: 'workspace',
    component: WorkspaceComponent,
    canActivate: [authGuard]
  },
  {
    path: 'projects',
    component: ProjectsComponent,
    canActivate: [authGuard]
  },
  {
    path: 'governance',
    component: GovernanceComponent,
    canActivate: [authGuard]
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'my-day'
  },
  {
    path: '**',
    redirectTo: 'my-day'
  }
];
