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
    this.isLoading.set(true);

    // Llamada al backend
    this.auth.loginLocal(this.loginData).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.loginSuccess.emit();
        this.router.navigateByUrl('/principal');
      },
      error: (err: any) => {
        this.isLoading.set(false);
        this.errorMessage.set('Correo o contraseña incorrectos');
        console.error('Error en login:', err);
      }
    });
  }
}
