import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../components/header/header';
import { SidebarComponent } from '../../components/sidebar/sidebar';
import { UsuariosService } from '../../services/usuarios.services';

interface Usuario {
  id: string;
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido: string;
  correo: string;
  numero_celular?: string;
  activo: boolean;
  perfil?: any;
}

@Component({
  selector: 'app-conductores',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, SidebarComponent],
  templateUrl: './conductores.html',
  styleUrls: ['./conductores.scss']
})
export class ConductoresComponent implements OnInit {
  private usuariosService = inject(UsuariosService);

  sidebarOpen = signal(true);
  conductores = signal<Usuario[]>([]);
  
  showRegistrarModal = signal(false);
  formConductor = signal({
    primerNombre: '',
    primerApellido: '',
    segundoApellido: '',
    correo: '',
    password: ''
  });

  ngOnInit() {
    this.cargarConductores();
  }

  cargarConductores() {
    this.usuariosService.getUsuarios().subscribe({
      next: (resp: any) => {
        const arr = Array.isArray(resp) ? resp : (resp.data || []);
        // Si hay una propiedad perfil con rol, filtramos, sino mostramos todos. 
        // Idealmente el backend debería darnos los conductores directamente o el componente lista todos
        this.conductores.set(arr);
      },
      error: (err) => {
        console.error('❌ Error cargando usuarios:', err);
        this.conductores.set([]);
      }
    });
  }

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  abrirModalRegistrar() {
    this.formConductor.set({
      primerNombre: '',
      primerApellido: '',
      segundoApellido: '',
      correo: '',
      password: ''
    });
    this.showRegistrarModal.set(true);
  }

  cerrarModalRegistrar() {
    this.showRegistrarModal.set(false);
  }

  guardarConductor() {
    const form = this.formConductor();
    
    if (!form.primerNombre || !form.primerApellido || !form.correo || !form.password) {
      alert('Completa los campos obligatorios (*)');
      return;
    }

    this.usuariosService.registrarConductor(form).subscribe({
      next: () => {
        this.cargarConductores();
        this.cerrarModalRegistrar();
      },
      error: (err) => {
        console.error('❌ Error guardando conductor:', err);
        alert('Error al registrar el conductor. Verifica los datos.');
      }
    });
  }

  eliminarConductor(c: Usuario) {
    if (confirm(`¿Eliminar conductor ${c.primerNombre} ${c.primerApellido}?`)) {
      this.usuariosService.eliminarUsuario(c.id).subscribe({
        next: () => this.cargarConductores(),
        error: () => alert('Error eliminando conductor')
      });
    }
  }
}
