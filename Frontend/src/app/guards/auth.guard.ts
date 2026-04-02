import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): boolean {
    const token = localStorage.getItem('token');
    // Si NO existe token → redirige al login
    if (!token) {
      this.router.navigate(['/']);
      return false;
    }
    return true;
  }
}
