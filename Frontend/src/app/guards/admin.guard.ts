import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.services';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {

  private auth = inject(AuthService);
  private router = inject(Router);

  canActivate(): boolean {

    const user = this.auth.currentUser();

    // ✅ SOLO ADMIN
    if (user?.rol === 'admin') {
      return true;
    }

    // 🚫 BLOQUEAR
    this.router.navigate(['/']);
    return false;
  }
}