import { Component, inject, signal, output } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.services';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  
  // Output para cerrar modal cuando sea exitoso
  loginSuccess = output<void>();
  
  // Señales para el estado del componente
  showPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  mostrarRegistro = signal(false);
  
  // Datos del formulario de login
  loginData = {
    correo: '',
    password: ''
  };

 

  /**
   * Cambiar a vista de login
   */
  cambiarALogin() {
    this.mostrarRegistro.set(false);
    this.errorMessage.set(null);
  }

  /**
   * Cambiar a vista de registro
   */
  cambiarARegistro() {
    this.mostrarRegistro.set(true);
    this.errorMessage.set(null);
  }

  /**
   * Iniciar sesión con correo y contraseña
   */
  onLogin() {
  // Limpiar error previo
  this.errorMessage.set(null);

  if (!this.loginData.correo || !this.loginData.password) {
    this.errorMessage.set('Ingresa correo y contraseña');
    return;
  }

  this.isLoading.set(true);

  this.auth.loginLocal(this.loginData).subscribe({
    
    // 🔥 IMPORTANTE: usar res
    next: (res: any) => {

      this.isLoading.set(false);

      const rol = res.usuario?.rol;

      console.log('ROL:', rol);

      // 🚫 BLOQUEAR SI NO ES ADMIN
      if (rol !== 'admin') {
        this.errorMessage.set('Solo administradores pueden acceder');
        this.auth.logout();
        return;
      }

      // ✅ PERMITIR
      this.loginSuccess.emit();
      this.router.navigateByUrl('/principal');

    },

    error: (err: any) => {

      this.isLoading.set(false);

      // 🔥 mostrar mensaje real del backend si existe
      if (err.error?.message) {
        this.errorMessage.set(err.error.message);
      } 
      else if (err.status === 401) {
        this.errorMessage.set('Credenciales incorrectas');
      } 
      else {
        this.errorMessage.set('No se pudo iniciar sesión');
      }

      console.error(err);
    }
  });
}
}
