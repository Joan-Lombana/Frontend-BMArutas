import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../components/header/header';
import { SidebarComponent } from '../../components/sidebar/sidebar';
import { RutasService } from '../../services/rutas.services';
import { VehiculosService } from '../../services/vehiculos.services';
import { UsuariosService } from '../../services/usuarios.services';
import { RecorridosService } from '../../services/recorridos.services';
interface Ruta { 
  id: string;      // UUID en el backend
  nombre_ruta: string;   // campo real del backend
  horario: string; 
  zona: string; 
  estado: string; 
}

@Component({
  selector: 'app-rutas',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, SidebarComponent],
  templateUrl: './rutas.html',
  styleUrls: ['./rutas.scss']
})
export class RutasComponent implements OnInit {
  private perfilId = 'bcadd725-99a9-458f-bb7f-2eea173c0eb3';
  private rutasService = inject(RutasService);
  private vehiculosService = inject(VehiculosService);
  private usuariosService = inject(UsuariosService);
  private recorridosService = inject(RecorridosService);

  sidebarOpen = signal(true);
  rutas = signal<Ruta[]>([]);
  vehiculosActivos = signal<any[]>([]);
  conductores = signal<any[]>([]);
  
  editando = signal<Ruta | null>(null);
  
  // Programar Modal
  rutaAProgramar = signal<Ruta | null>(null);
  formRecorrido = signal({ vehiculo_id: '', conductor_id: '', fecha_inicio: '' });

  recorridos = signal<any[]>([]);

  ngOnInit() { 
    this.cargarRutas(); 
    this.cargarDatosDesplegables();
    this.cargarRecorridos();
  }

  cargarRecorridos() {
    this.recorridosService.getRecorridos(this.perfilId).subscribe({
      next: (resp: any) => {
        const arr = Array.isArray(resp) ? resp : (resp.data || []);
        console.log('🛣️ [Rutas Page] Recorridos cargados:', arr.length);
        if (arr.length > 0) {
          console.log('🛣️ [Rutas Page] Primer recorrido:', JSON.stringify(arr[0]));
          console.log('🛣️ [Rutas Page] Campos disponibles:', Object.keys(arr[0]));
        }
        this.recorridos.set(arr);
      }
    });
  }

  getRecorridoActivo(rutaId: string) {
    // Retorna el recorrido activo para la ruta actual (incluye todos los estados válidos de la API)
    return this.recorridos().find(r => r.ruta_id === rutaId && ['programado', 'en_curso', 'activo', 'asignado', 'iniciado', 'pendiente'].includes(r.estado));
  }

  getNombreConductor(conductorId: string) {
    const c = this.conductores().find(x => x.id === conductorId);
    return c ? `${c.primerNombre || ''} ${c.primerApellido || ''}` : 'Conductor';
  }

  getNombreVehiculo(vehiculoId: string) {
    const v = this.vehiculosActivos().find(x => x.id === vehiculoId);
    return v ? `${v.placa}` : 'Vehículo';
  }

  cargarDatosDesplegables() {
    this.vehiculosService.getVehiculos(this.perfilId).subscribe({
      next: (resp: any) => {
        const arr = Array.isArray(resp) ? resp : (resp.data || []);
        this.vehiculosActivos.set(arr.filter((v: any) => v.activo));
      }
    });

    this.usuariosService.getUsuarios().subscribe({
      next: (resp: any) => {
        const arr = Array.isArray(resp) ? resp : (resp.data || []);
        this.conductores.set(arr.filter((u: any) => u.activo));
      }
    });
  }

  cargarRutas() {
    this.rutasService.getRutas(this.perfilId).subscribe({
      next: (resp: any) => {
        const arr = Array.isArray(resp) ? resp : (resp.data || resp.rutas || []);
        this.rutas.set(arr);
      },
      error: () => this.rutas.set([])
    });
  }

  toggleSidebar() { 
    this.sidebarOpen.update(v => !v); 
  }

  eliminarRuta(ruta: Ruta) {
    if (confirm(`¿Eliminar ruta "${ruta.nombre_ruta}"?`)) {
      this.rutasService.eliminarRuta(ruta.id).subscribe({
        next: () => this.cargarRutas(),
        error: () => alert('Error eliminando ruta')
      });
    }
  }

  editarRuta(ruta: Ruta) {
    this.editando.set({ ...ruta });
  }

  cancelarEdicion() {
    this.editando.set(null);
  }

  guardarEdicion() {
    const ruta = this.editando();
    if (!ruta) return;
    this.rutasService.actualizarRuta(ruta.id, ruta).subscribe({
      next: () => {
        this.editando.set(null);
        this.cargarRutas();
      },
      error: () => alert('Error actualizando ruta')
    });
  }

  // --- PROGRAMAR ---
  abrirModalProgramar(ruta: Ruta) {
    this.rutaAProgramar.set(ruta);
    this.formRecorrido.set({ vehiculo_id: '', conductor_id: '', fecha_inicio: '' });
  }

  cerrarModalProgramar() {
    this.rutaAProgramar.set(null);
  }

  guardarPrograma() {
    const r = this.rutaAProgramar();
    const f = this.formRecorrido();
    if (!r || !f.vehiculo_id || !f.conductor_id || !f.fecha_inicio) {
      alert('Rellena todos los campos para programar el recorrido.');
      return;
    }

    let fechaISO = '';
    try {
      fechaISO = new Date(f.fecha_inicio).toISOString();
    } catch (e) {
      alert('Fecha inválida');
      return;
    }

    const payload = {
      ruta_id: r.id,
      vehiculo_id: f.vehiculo_id,
      conductor_id: f.conductor_id,
      horario_inicio: fechaISO,  // <-- Formato válido ISO obligatorio para backends estrictos
      estado: 'programado'
    };

    this.recorridosService.programarRecorrido(payload, this.perfilId).subscribe({
      next: () => {
        this.cerrarModalProgramar();
        this.cargarRutas(); // Refrescar para ver si cambia el estado
        this.cargarRecorridos(); // Refrescar los recorridos para ver el conductor asignado
        alert('🚌 Recorrido programado exitosamente');
      },
      error: (err) => {
        console.error("Error backend:", err);
        alert('Error programando el recorrido: Verifica los datos o la consola.');
      }
    });
  }

  visualizarRuta(ruta: Ruta) {
    console.log('Visualizar:', ruta);
  }
}
