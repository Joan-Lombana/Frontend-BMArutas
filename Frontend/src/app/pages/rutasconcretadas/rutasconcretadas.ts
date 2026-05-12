import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';

import { SidebarComponent } from '../../components/sidebar/sidebar';
import { HeaderComponent } from '../../components/header/header';
import { RecorridosService } from '../../services/recorridos.services';
import { RutasService } from '../../services/rutas.services';
import { UsuariosService } from '../../services/usuarios.services';
import { VehiculosService } from '../../services/vehiculos.services';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rutasconcretadas',
  imports: [SidebarComponent, HeaderComponent, CommonModule],
  templateUrl: './rutasconcretadas.html',
  styleUrl: './rutasconcretadas.scss',
})
export class RutasConcretadasComponent implements OnInit {

  // =========================
  // SERVICES
  // =========================

  private recorridosService = inject(RecorridosService);
  private rutasService = inject(RutasService);
  private usuariosService = inject(UsuariosService);
  private vehiculosService = inject(VehiculosService);

  // =========================
  // UI
  // =========================

  sidebarOpen = signal(true);
  buscarRuta = signal('');
  ordenarPor = signal<'nombre' | 'fecha'>('nombre');

  // Estados del menú de filtros
  filtroMenuAbierto = signal(false);
  seccionAbierta = signal<{ ruta: boolean; fecha: boolean }>({ ruta: false, fecha: false });
  selectedRecorrido = signal<any | null>(null);


  // Filtros de fecha
  fechaDesde = signal<string>('');
  fechaHasta = signal<string>('');
  
  // Opciones de fecha rápida
  opcionesFechaRapida = [
    { label: 'Hoy', valor: 'hoy' },
    { label: 'Últimos 7 días', valor: '7dias' },
    { label: 'Últimos 30 días', valor: '30dias' },
    { label: 'Este mes', valor: 'mes' }
  ];

  // =========================
  // DATA
  // =========================

  recorridosFinalizados = signal<any[]>([]);
  rutas = signal<any[]>([]);
  conductores = signal<any[]>([]);
  vehiculos = signal<any[]>([]);

  // =========================
  // INIT
  // =========================

  ngOnInit(): void {
    this.cargarRecorridosFinalizados();
    this.cargarRutas();
    this.cargarConductores();
    this.cargarVehiculos();
  }


  // =========================
  // RECORRIDOS
  // =========================

     
  cargarRecorridosFinalizados() {

    this.recorridosService.getRecorridos().subscribe({

      next: (resp: any) => {

        const arr = Array.isArray(resp)
          ? resp
          : (resp.data || []);

        const finalizados = arr.filter(
          (recorrido: any) =>
            (recorrido.estado || '')
              .toString()
              .toLowerCase()
              .trim() === 'finalizado'
        );

        this.recorridosFinalizados.set(finalizados);

        console.log('✅ Finalizados cargados:', finalizados.length);
      },

      error: (err) => {

        console.error('❌ Error cargando recorridos', err);

        this.recorridosFinalizados.set([]);
      },
    });
  }

  cargarRutas() {
    this.rutasService.getRutas().subscribe({
      next: (resp: any) => {
        const arr = Array.isArray(resp) ? resp : (resp.data || resp.rutas || []);
        this.rutas.set(arr);
      },
      error: () => {
        this.rutas.set([]);
      },
    });
  }

  // =========================
  // SIDEBAR
  // =========================

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  getRecorridosFiltrados() {

    const busqueda = this.buscarRuta()
      .trim()
      .toLowerCase();

    const ordenamiento = this.ordenarPor();
    const desde = this.fechaDesde();
    const hasta = this.fechaHasta();

    return this.recorridosFinalizados()
      .filter(recorrido => {

        // Filtro por nombre de ruta
        const nombreRuta = this.getNombreRuta(recorrido.ruta_id)
          .toLowerCase();
        const cumpleNombre = !busqueda || nombreRuta.includes(busqueda);

        // Filtro por fecha
        let fechaRecorrido: Date;
        
        // Mejorar manejo de fechas con validación
        if (recorrido.updatedAt) {
          fechaRecorrido = new Date(recorrido.updatedAt);
        } else if (recorrido.createdAt) {
          fechaRecorrido = new Date(recorrido.createdAt);
        } else {
          fechaRecorrido = new Date(0); // Fecha por defecto
        }
        
        // Validar que la fecha sea válida
        if (isNaN(fechaRecorrido.getTime())) {
          fechaRecorrido = new Date(0);
        }
        
        const fechaDesdeMs = desde && !isNaN(new Date(desde).getTime()) ? new Date(desde).getTime() : 0;
        const fechaHastaMs = hasta && !isNaN(new Date(hasta).getTime()) ? new Date(hasta + 'T23:59:59').getTime() : Infinity;
        
        const cumpleFecha = fechaRecorrido.getTime() >= fechaDesdeMs && 
                          fechaRecorrido.getTime() <= fechaHastaMs;

        return cumpleNombre && cumpleFecha;
      })
      .sort((a, b) => {
        
        if (ordenamiento === 'nombre') {
          // Ordenar por nombre de ruta alfabéticamente
          const nombreA = this.getNombreRuta(a.ruta_id);
          const nombreB = this.getNombreRuta(b.ruta_id);
          
          return nombreA.localeCompare(nombreB, 'es', { 
            sensitivity: 'base',
            numeric: false 
          });
        } else {
          // Ordenar por fecha de finalización (más recientes primero)
          const fechaA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const fechaB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          
          return fechaB - fechaA; // Más recientes primero
        }
      });
  }

  getNombreRuta(rutaId: string): string {
    const ruta = this.rutas().find(r => r.id === rutaId);
    return ruta?.nombre_ruta || 'Ruta sin nombre';
  }

  // =========================
  // MÉTODOS DEL MENÚ DESPLEGABLE
  // =========================

  toggleFiltroMenu() {
    this.filtroMenuAbierto.update(v => !v);
  }

  toggleSeccion(seccion: 'ruta' | 'fecha') {
    this.seccionAbierta.update(current => ({
      ...current,
      [seccion]: !current[seccion]
    }));
  }

  aplicarFiltroFechaRapida(opcion: string) {
    const hoy = new Date();
    
    try {
      switch (opcion) {
        case 'hoy':
          this.fechaDesde.set(this.formatDate(hoy));
          this.fechaHasta.set(this.formatDate(hoy));
          break;
        case '7dias':
          const hace7Dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
          this.fechaDesde.set(this.formatDate(hace7Dias));
          this.fechaHasta.set(this.formatDate(hoy));
          break;
        case '30dias':
          const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
          this.fechaDesde.set(this.formatDate(hace30Dias));
          this.fechaHasta.set(this.formatDate(hoy));
          break;
        case 'mes':
          const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
          const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
          this.fechaDesde.set(this.formatDate(primerDiaMes));
          this.fechaHasta.set(this.formatDate(ultimoDiaMes));
          break;
        default:
          console.warn('Opción de fecha rápida no reconocida:', opcion);
      }
    } catch (error) {
      console.error('Error aplicando filtro de fecha rápida:', error);
      // En caso de error, limpiar los filtros de fecha
      this.fechaDesde.set('');
      this.fechaHasta.set('');
    }
  }

  aplicarFiltros() {
    this.filtroMenuAbierto.set(false);
  }

  limpiarFiltros() {
    this.buscarRuta.set('');
    this.fechaDesde.set('');
    this.fechaHasta.set('');
    this.filtroMenuAbierto.set(false);
  }

  limpiarFiltroRuta() {
    this.buscarRuta.set('');
  }

  limpiarFiltroFecha() {
    this.fechaDesde.set('');
    this.fechaHasta.set('');
  }

  hayFiltrosActivos(): boolean {
    return !!(this.buscarRuta() || this.fechaDesde() || this.fechaHasta());
  }

  getRangoFechasText(): string {
    const desde = this.fechaDesde();
    const hasta = this.fechaHasta();
    
    if (desde && hasta) {
      return `${this.formatDateDisplay(desde)} - ${this.formatDateDisplay(hasta)}`;
    } else if (desde) {
      return `Desde ${this.formatDateDisplay(desde)}`;
    } else if (hasta) {
      return `Hasta ${this.formatDateDisplay(hasta)}`;
    }
    
    return '';
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDateDisplay(dateStr: string): string {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    
    // Validar que la fecha sea válida
    if (isNaN(date.getTime())) {
      return dateStr; // Retornar el string original si es inválido
    }
    
    try {
      return date.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch (error) {
      console.warn('Error formateando fecha:', error);
      return dateStr; // Fallback al string original
    }
  }

  // =========================
  // CONDUCTORES
  // =========================

  cargarConductores() {

    this.usuariosService.getUsuarios().subscribe({

      next: (resp: any) => {

        const arr = Array.isArray(resp)
          ? resp
          : (resp.data || []);

        this.conductores.set(arr);
      },

      error: (err) => {
        console.error('❌ Error cargando conductores', err);
      },
    });
  }

  getNombreConductor(conductorId: string) {

    const conductor = this.conductores()
      .find(c => c.id === conductorId);

    if (!conductor) return 'Conductor';

    return `${conductor.primerNombre || ''} ${conductor.primerApellido || ''}`.trim();
  }

  // =========================
  // VEHÍCULOS
  // =========================

  cargarVehiculos() {

    this.vehiculosService.getVehiculos().subscribe({

      next: (resp: any) => {

        const arr = Array.isArray(resp)
          ? resp
          : (resp.data || []);

        this.vehiculos.set(arr);
      },

      error: (err) => {
        console.error('❌ Error cargando vehículos', err);
      },
    });
  }

  getNombreVehiculo(vehiculoId: string) {

    const vehiculo = this.vehiculos()
      .find(v => v.id === vehiculoId);

    if (!vehiculo) return 'Vehículo';

    return `${vehiculo.placa || ''} ${vehiculo.modelo || ''}`.trim();
  }

  // =========================
  // VISUALIZACIÓN
  // =========================

  visualizarRecorrido(recorrido: any) {
    this.selectedRecorrido.set(recorrido);
  }

  // =========================
  // HELPERS
  // =========================

  getDuracion(inicio: string, fin: string) {

    if (!inicio || !fin) return 'N/A';

    const start = new Date(inicio).getTime();
    const end = new Date(fin).getTime();

    if (isNaN(start) || isNaN(end)) return 'N/A';

    const diff = end - start;

    const horas = Math.floor(diff / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${horas}h ${minutos}m`;
  }

  getCantidadEventos(recorrido: any) {
    return recorrido?.eventos?.length ?? 0;
  }

  tieneErrores(recorrido: any): boolean {
    return (
      recorrido?.eventos?.some(
        (e: any) =>
          (e.tipo || '').toString().toUpperCase() === 'ERROR_SINCRONIZACION'
      ) ?? false
    );
  }

  getUltimoEvento(recorrido: any) {

    const eventos = recorrido?.eventos;

    if (!Array.isArray(eventos) || eventos.length === 0) {
      return null;
    }

    return eventos[eventos.length - 1];
  }
}
