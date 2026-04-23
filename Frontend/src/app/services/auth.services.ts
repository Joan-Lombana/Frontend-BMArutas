import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth`;

  // ============================
  // SIGNAL USUARIO (persistente)
  // ============================

  currentUser = signal<any | null>(this.getUserFromStorage());

  // ============================
  // LOGIN
  // ============================

  loginLocal(data: { correo: string; password: string }): Observable<any> {

    return this.http.post(`${this.apiUrl}/login`, data).pipe(

      tap((response: any) => {

        // 🔥 guardar token
        if (response?.access_token) {
          localStorage.setItem('token', response.access_token);
        }

        // 🔥 guardar usuario
        if (response?.usuario) {
          this.currentUser.set(response.usuario);
          localStorage.setItem('usuario', JSON.stringify(response.usuario));
        }

      })

    );

  }

  // ============================
  // REGISTER (crear conductor)
  // ============================

  register(data: any): Observable<any> {

    const token = this.getToken();

    return this.http.post(
      `${environment.apiUrl}/usuario/crear`,
      data,
      {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token || ''}`
        })
      }
    );

  }

  // ============================
  // PROFILE
  // ============================

  getProfile(): Observable<any> {

    const token = this.getToken();

    if (!token) {
      return of(null);
    }

    return this.http.get(`${this.apiUrl}/profile`, {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`
      })
    }).pipe(

      tap((user: any) => {
        this.currentUser.set(user);
        localStorage.setItem('usuario', JSON.stringify(user));
      })

    );

  }

  // ============================
  // TOKEN
  // ============================

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  // ============================
  // USUARIO DESDE STORAGE
  // ============================

  private getUserFromStorage(): any | null {
    try {
      const user = localStorage.getItem('usuario');
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error('Error leyendo usuario del storage', error);
      return null;
    }
  }

  // ============================
  // ESTADO LOGIN
  // ============================

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  // ============================
  // HEADERS AUTORIZADOS
  // ============================

  getAuthHeaders() {
    const token = this.getToken();

    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token || ''}`
      })
    };
  }

  // ============================
  // LOGOUT
  // ============================

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    this.currentUser.set(null);
  }

}
