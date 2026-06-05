import { Component, signal, OnInit, inject, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HeaderComponent } from '../../components/header/header';
import { SidebarComponent } from '../../components/sidebar/sidebar';
import { MapaComponent } from '../../components/mapa/mapa';
import { Herramientasmapa } from '../../components/herramientasmapa/herramientasmapa';

import { VehiculosService } from '../../services/vehiculos.services';
import { RutasService } from '../../services/rutas.services';
import { RecorridosService } from '../../services/recorridos.services';
import { UsuariosService } from '../../services/usuarios.services';
import { LeafletMapService } from '../../services/leaflet-map.services';
import { WebSocketService } from '../../services/websocket.service';

interface Ruta {
  id: string;
  nombre_ruta: string;
  horario: string;
  zona: string;
  estado: string;
  shape: string;
}

interface Recorrido {
  id: string;
  ruta_id: string;
  vehiculo_id: string;
  conductor_id: string;
  fecha_inicio?: string;
  fecha_programada?: string;
  horario_inicio?: string;
  estado: string;
  ruta?: any;
}

interface Vehiculo {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  activo: boolean;
}

interface Stats {
  vehiculosActivos: number;
  rutasCompletadas: number;
  rutasActivas: number;
}

interface FormRuta {
  nombre: string;
  zona: string;
  horario: string;
}

interface FormVehiculo {
  placa: string;
  modelo: string;
  marca: string;
  activo: boolean;
}

interface FormDireccion {
  rutaId: string;
  direccion: string;
  orden: number;
}

@Component({
  selector: 'app-principal',
  standalone: true,
  imports: [
    HeaderComponent,
    SidebarComponent,
    MapaComponent,
    CommonModule,
    Herramientasmapa
  ],
  templateUrl: './principal.html',
  styleUrls: ['./principal.scss']
})
export class PrincipalComponent implements OnInit {

  // =========================
  // SERVICES
  // =========================

  private vehiculosService = inject(VehiculosService);
  private rutasService = inject(RutasService);
  private recorridosService = inject(RecorridosService);
  private usuariosService = inject(UsuariosService);
  private router = inject(Router);
  private mapService = inject(LeafletMapService);
  private ws = inject(WebSocketService);
  private destroyRef = inject(DestroyRef);

  // =========================
  // STATE (SIN CAMBIOS)
  // =========================

  sidebarOpen = signal(false);

  vehiculoSeleccionado = signal<Vehiculo | null>(null);

  mapFullscreen = signal(false);

  showRegistrarRutaModal = signal(false);
  showRegistrarVehiculoModal = signal(false);
  showIngresarDireccionModal = signal(false);
  showRouteTools = signal(false);
  mapMode = signal<'live' | 'draw'>('live');

  formRuta = signal<FormRuta>({ nombre: '', zona: '', horario: '' });
  formVehiculo = signal<FormVehiculo>({ placa: '', modelo: '', marca: '', activo: true });
  formDireccion = signal<FormDireccion>({ rutaId: '', direccion: '', orden: 1 });

  rutas = signal<Ruta[]>([]);
  recorridos = signal<Recorrido[]>([]);
  rutaSeleccionada = signal<string | null>(null);
  private salasUnidas = new Set<string>();

  vehiculos = signal<Vehiculo[]>([]);
  conductores = signal<any[]>([]);
  stats = signal<Stats>({
    vehiculosActivos: 0,
    rutasCompletadas: 0,
    rutasActivas: 0
  });

  // =========================
  // INIT
  // =========================

  ngOnInit() {
    this.cargarRutas();
    this.cargarVehiculos();
    this.cargarConductores();
    this.cargarRecorridos();
    this.configurarWebSocket();
  }

  // =========================
  // RUTAS
  // =========================

  cargarRutas() {
    this.rutasService.getRutas().subscribe({
      next: (resp: any) => {
        const data = Array.isArray(resp.data) ? resp.data : [];
        this.rutas.set(data);
      },
      error: (err) => {
        console.error('❌ Error cargando rutas', err);
        this.rutas.set([]);
      },
    });
  }

  // =========================
  // RECORRIDOS + MAPA FIX 🔥
  // =========================

  cargarRecorridos() {
    this.recorridosService.getRecorridos().subscribe({
      next: (resp: any) => {

        const arr: Recorrido[] = Array.isArray(resp)
          ? resp
          : (resp.data || []);

        this.recorridos.set(arr);

        arr.forEach((recorrido) => {
          const estado = (recorrido.estado || '').toLowerCase();

          if (
            ['programada', 'programado', 'activa', 'activo', 'pausado'].includes(estado) &&
            !this.salasUnidas.has(recorrido.id)
          ) {
            this.ws.unirseRecorrido(recorrido.id);
            this.salasUnidas.add(recorrido.id);
          }
        });

        this.actualizarStats();
      },
      error: (err) => {
        console.error('❌ Error cargando recorridos:', err);
        this.recorridos.set([]);
      }
    });
  }

  // =========================
  // VEHÍCULOS
  // =========================

  cargarVehiculos() {
    this.vehiculosService.getVehiculos().subscribe({
      next: (resp: any) => {
        const arr = Array.isArray(resp) ? resp : (resp.data || []);
        this.vehiculos.set(arr);
      },
      error: (err) => {
        console.error('❌ Error cargando vehículos:', err);
        this.vehiculos.set([]);
      }
    });
  }

  cargarConductores() {
    this.usuariosService.getUsuarios().subscribe({
      next: (resp: any) => {
        const arr = Array.isArray(resp) ? resp : (resp.data || []);
        this.conductores.set(arr);
      },
      error: () => this.conductores.set([])
    });
  }

  // =========================
  // WEBSOCKET FIX 🔥
  // =========================

  configurarWebSocket() {
    this.ws.onEstadoRecorrido()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: any) => {
        const estado = (data.estado || '').toLowerCase();

        this.recorridos.update(list =>
          list.map(r =>
            r.id === data.recorridoId
              ? { ...r, estado: data.estado }
              : r
          )
        );

        if (estado === 'finalizado' || estado === 'finalizada') {
          this.mapService.removerVehiculo(data.recorridoId);
          this.mapService.removerRutaViva(data.recorridoId);
          this.mapService.clearPhotoMarkers();
          this.ws.salirRecorrido(data.recorridoId);
          this.salasUnidas.delete(data.recorridoId);
          this.cargarRecorridos();
        }
      });

    this.ws.onLocationPhoto()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: any) => {
        console.log('📷 Foto en vivo recibida en mapa:', data);
        if (data.lat && data.lon && data.imagen_base64) {
          this.mapService.showPhotoMarker(
            data.lat,
            data.lon,
            data.capturado_ts || Date.now(),
            data.imagen_base64,
          );
        }
      });

    this.ws.onRecorridoEliminado()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: any) => {

        this.recorridos.update(list =>
          list.filter(r => r.id !== data.recorridoId)
        );
        // Remove visual elements (live route, vehicle, path to start)
        this.mapService.removerRutaViva(data.recorridoId);
        this.mapService.removerVehiculo(data.recorridoId);
      });

    this.ws.onPosicion()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: any) => {
        const recorrido = this.recorridos().find(r => r.id === data.recorridoId);
        const ruta = this.rutas().find(r => r.id === recorrido?.ruta_id);
        const vehiculo = this.vehiculos().find(v => v.id === recorrido?.vehiculo_id);

        this.mapService.actualizarVehiculo(
          data.recorridoId,
          data.latitud ?? data.lat,
          data.longitud ?? data.lng,
          {
            ruta: recorrido?.ruta?.nombre_ruta || ruta?.nombre_ruta,
            conductor: recorrido?.conductor_id ? this.getDetalleConductor(recorrido.conductor_id) : undefined,
            placa: vehiculo?.placa
          }
        );
      });

    this.ws.onPosicionActualizada()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: any) => {
        console.log('✏️ Posición actualizada:', data);
      });
  }

  getDetalleConductor(id: string): string {
    const conductor = this.conductores().find(c => c.id === id);
    return conductor
      ? `${conductor.nombre || ''} ${conductor.apellido || ''}`.trim()
      : 'Conductor desconocido';
  }

  getDetalleVehiculo(id: string): string {
    const vehiculo = this.vehiculos().find(v => v.id === id);
    return vehiculo
      ? `${vehiculo.placa} - ${vehiculo.marca} ${vehiculo.modelo}`
      : 'Vehículo desconocido';
  }

  getDetalleRuta(id: string): string {
    const ruta = this.rutas().find(r => r.id === id);
    return ruta?.nombre_ruta || 'Ruta sin nombre';
  }

  // =========================
  // SELECCIÓN RUTA MAPA
  // =========================

  seleccionarRuta(event: Event) {

    const id = (event.target as HTMLSelectElement).value;

    this.rutaSeleccionada.set(id);

    if (!id) {
      this.mapService.resetMap();
      this.mapService.clearPhotoMarkers();
      this.mapService.syncMapa(this.recorridos());
      return;
    }

    const ruta = this.rutas().find(r => r.id === id);
    if (!ruta?.shape) return;

    const shape = JSON.parse(ruta.shape);

    const coords =
      shape.type === 'LineString'
        ? shape.coordinates
        : shape.coordinates.flat();

    this.mapService.showRoute(coords);
  }

  // =========================
  // STATS
  // =========================

  actualizarStats() {

    const vehiculosActivos =
      this.vehiculos().filter(v => v.activo).length;

    const rutasCompletadas =
      this.recorridos().filter(r =>
        ['finalizado', 'completado'].includes((r.estado || '').toLowerCase())
      ).length;

    const rutasActivas =
      this.recorridos().filter(r =>
        ['programada', 'activa', 'pausado'].includes((r.estado || '').toLowerCase())
      ).length;

    this.stats.set({
      vehiculosActivos,
      rutasCompletadas,
      rutasActivas
    });
  }

  // =========================
  // UI (SIN ELIMINAR NADA)
  // =========================

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
    this.mapService.resizeMap();
  }

  setMapMode(mode: 'live' | 'draw') {
    this.mapMode.set(mode);
    this.mapService.setMode(mode);
  }

  toggleMapFullscreen() {
    this.mapFullscreen.update(v => !v);
    setTimeout(() => this.mapService.resizeMap(), 200);
  }

  seleccionarVehiculo(v: Vehiculo) {
    this.vehiculoSeleccionado.set(v);
  }

  irAConductores() {
    this.router.navigate(['/conductores']);
  }

  abrirModalRegistrarRuta() {
    this.showRegistrarRutaModal.set(true);
  }

  cerrarModalRegistrarRuta() {
    this.showRegistrarRutaModal.set(false);
  }

  abrirModalRegistrarVehiculo() {
    this.showRegistrarVehiculoModal.set(true);
  }

  cerrarModalRegistrarVehiculo() {
    this.showRegistrarVehiculoModal.set(false);
  }

  abrirModalIngresarDireccion() {
    this.showIngresarDireccionModal.set(true);
  }

  cerrarModalIngresarDireccion() {
    this.showIngresarDireccionModal.set(false);
  }

  obtenerUbicacion() {
    if (!navigator.geolocation) {
      alert('Geolocalización no está disponible en este navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        this.mapService.mostrarUbicacion(lat, lng);
      },
      (error) => {
        console.error('Error al obtener posición:', error);
        alert('No se pudo obtener la ubicación.');
      }
    );
  }


  trazarRuta() {
    if (this.mapMode() !== 'draw') {
      alert('Para trazar una nueva ruta, primero debe habilitar el "✏️ Modo Trazado" en los controles superiores del mapa.');
      return;
    }
    this.showRouteTools.set(true);
    this.showRegistrarRutaModal.set(false);
  }
  guardarRuta() {
    // Implementación futura para guardar la ruta
    console.log('guardarRuta ejecutado');
  }

  guardarVehiculo() {
  const vehiculo = this.formVehiculo();
  if (!vehiculo.placa || !vehiculo.modelo || !vehiculo.marca) {
    alert('⚠️ Todos los campos son obligatorios');
    return;
  }
  if (!confirm(`¿Desea registrar el vehículo ${vehiculo.placa}?`)) {
    return;
  }

  this.vehiculosService.registrarVehiculo(vehiculo).subscribe({
    next: () => {
      alert('✅ Vehículo registrado correctamente');
      this.cargarVehiculos();
      this.actualizarStats();
      this.formVehiculo.set({
        placa: '',
        modelo: '',
        marca: '',
        activo: true
      });

      this.cerrarModalRegistrarVehiculo();
    },
    error: (err) => {
      console.error(err);
      alert('❌ Error al registrar el vehículo');
    }
  });
  }
  guardarDireccion() { }
}
