import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth`;

  // usuario actual
  currentUser = signal<any>(null);

  // ============================
  // LOGIN LOCAL
  // ============================

  loginLocal(data: { correo: string; password: string }): Observable<any> {

    return this.http.post(`${this.apiUrl}/login`, data).pipe(

      tap((response: any) => {

        // guardar token
        if (response.access_token) {
          localStorage.setItem('token', response.access_token);
        }

        // guardar usuario
        if (response.usuario) {
          this.currentUser.set(response.usuario);
        }

      })

    );

  }

  // ============================
  // REGISTER
  // ============================

  register(data: {
    primerNombre: string;
    segundoNombre?: string;
    primerApellido: string;
    segundoApellido: string;
    correo: string;
    password: string;
  }): Observable<any> {

    return this.http.post(`${this.apiUrl}/register`, data);

  }

  // ============================
  // PROFILE
  // ============================

  getProfile(): Observable<any> {

    const token = localStorage.getItem('token');

    if (!token) {
      return of(null);
    }

    return this.http.get(`${this.apiUrl}/profile`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }).pipe(
      tap(user => this.currentUser.set(user))
    );

  }

  // ============================
  // LOGOUT
  // ============================

  logout(): void {

    localStorage.removeItem('token');
    this.currentUser.set(null);

  }

}
