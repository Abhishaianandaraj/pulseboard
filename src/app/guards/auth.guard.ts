import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TaskStoreService } from '../services/task-store.service';

export const authGuard: CanActivateFn = () => {
  const store = inject(TaskStoreService);
  const router = inject(Router);

  if (store.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
