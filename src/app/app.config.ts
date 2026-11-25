import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import {
  TaskRepository,
  LocalStorageTaskRepository,
  PostgresApiTaskRepository
} from './services/task-repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideAnimations(),
    provideHttpClient(),
    {
      provide: TaskRepository,
      useClass: environment.useBackendApi ? PostgresApiTaskRepository : LocalStorageTaskRepository
    }
  ]
};
