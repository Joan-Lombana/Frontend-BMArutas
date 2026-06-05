import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../components/header/header';
import { SidebarComponent } from '../../components/sidebar/sidebar';
import { VehiculosService } from '../../services/vehiculos.services';

interface Vehiculo { 
  id: string; 
  placa: string; 
  modelo: string; 
  marca: string; 
  activo: boolean; 
}

@Component({
  selector: 'app-vehiculos',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, SidebarComponent],
  templateUrl: './vehiculos.html',
  styleUrls: ['./vehiculos.scss']
})
export class VehiculosComponent implements OnInit {

  private vehiculosService = inject(VehiculosService);
  private perfilId = 'a0a5a0dc-10c0-4c69-b1b4-bc7509ca003c';

  sidebarOpen = signal(true);
  vehiculos = signal<Vehiculo[]>([]);
  editando = signal<Vehiculo | null>(null);

  ngOnInit() { 
    this.cargarVehiculos(); 
  }

  cargarVehiculos() {
    this.vehiculosService.getVehiculos().subscribe({
      next: (resp: any) => {
        const arr = Array.isArray(resp) ? resp : (resp.data || resp.vehiculos || []);
        this.vehiculos.set(arr);
      },
      error: () => this.vehiculos.set([])
    });
  }

  toggleSidebar() { 
    this.sidebarOpen.update(v => !v); 
  }

  eliminarVehiculo(v: Vehiculo) {
  if (!confirm(`¿Está seguro de eliminar el vehículo ${v.placa}?`)) {
    return;
  }
  this.vehiculosService.eliminarVehiculo(v.id).subscribe({
    next: () => {
      alert('✅ Vehículo eliminado correctamente');
      this.cargarVehiculos();
    },
    error: (err) => {
      console.error(err);
      alert('❌ No fue posible eliminar el vehículo');
    }
  });
  }

  editarVehiculo(v: Vehiculo) {
    // Crear una copia del objeto para editar
    this.editando.set({ ...v });
  }

  actualizarCampo(key: keyof Vehiculo, value: any) {
    const v = this.editando();
    if (!v) return;
    this.editando.set({ ...v, [key]: value });
  }

  cancelarEdicion() { 
    this.editando.set(null); 
  }

  guardarEdicion() {
    const v = this.editando();
    if (!v) return;

    this.vehiculosService.actualizarVehiculo(v.id, v).subscribe({ // <- PASAR perfilId
      next: () => {
        this.editando.set(null);
        this.cargarVehiculos();
      },
      error: () => alert('Error actualizando vehículo')
    });
  }
}

