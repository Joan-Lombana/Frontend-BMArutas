import { Component, signal, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
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
  fecha_inicio: string;
  horario_inicio?: string;
  estado: string;
  // Datos enriquecidos (pueden venir del backend o los buscamos localmente)
  nombre_ruta?: string;
  conductor_nombre?: string;
  vehiculo_placa?: string;
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
  imports: [HeaderComponent, SidebarComponent, MapaComponent, CommonModule, Herramientasmapa],
  templateUrl: './principal.html',
  styleUrls: ['./principal.scss']
})
export class PrincipalComponent implements OnInit {
  
  private vehiculosService = inject(VehiculosService);
  private rutasService = inject(RutasService);
  private recorridosService = inject(RecorridosService);
  private usuariosService = inject(UsuariosService);
  private router = inject(Router);
  private perfilId = 'bcadd725-99a9-458f-bb7f-2eea173c0eb3';
  private mapService = inject(LeafletMapService);
  private webSocketService = inject(WebSocketService);
  
  private recorridoActivoId: string | null = null;

  sidebarOpen = signal(false);
  vehiculoSeleccionado = signal<Vehiculo | null>(null);

  // Paneles Administrativos
  mapFullscreen = signal(false);

  showRegistrarRutaModal = signal(false);
  showRegistrarVehiculoModal = signal(false);
  showIngresarDireccionModal = signal(false);
  showRouteTools = signal(false);
  
  formRuta = signal<FormRuta>({ nombre: '', zona: '', horario: '' });
  formVehiculo = signal<FormVehiculo>({ placa: '', modelo: '', marca: '', activo: true });
  formDireccion = signal<FormDireccion>({ rutaId: '', direccion: '', orden: 1 });
  
  rutas = signal<Ruta[]>([]);
  recorridos = signal<Recorrido[]>([]);
  rutaSeleccionada = signal<string | null>(null);

  vehiculos = signal<Vehiculo[]>([]);
  conductores = signal<any[]>([]);
  stats = signal<Stats>({ vehiculosActivos: 0, rutasCompletadas: 0, rutasActivas: 0 });


  // ---------------------------------------------------------
  // INICIO
  // ---------------------------------------------------------
  ngOnInit() {
    this.cargarRutas();
    this.cargarVehiculos();
    this.cargarConductores();
    this.cargarRecorridos();

    // Escuchar posiciones en tiempo real
    this.webSocketService.onPosicion((pos: any) => {
      console.log('📍 Posición en vivo recibida:', pos);
      if (pos.latitud && pos.longitud) {
        this.mapService.updateDriverPosition(pos.latitud, pos.longitud);
      }
    });

    // Escuchar cambios de estado de los recorridos
    this.webSocketService.onEstadoRecorrido((data: any) => {
      console.log('🔄 Estado de recorrido actualizado:', data);
      
      // En vez de mapear, recargamos de base de datos para asegurar 
      // que si es un recorrido NUEVO (recién asignado), se agregue a la lista.
      this.cargarRecorridos();

      // Si la ruta actualizada es la que el admin está viendo en el mapa
      const rutaViendo = this.rutaSeleccionada();
      
      // Tenemos que esperar a que cargarRecorridos termine para ver si aplica,
      // pero por si acaso, si es 'Activa' y concuerda con la ruta, nos unimos.
      // Lo validaremos en el cargarRecorridos o con setTimeout:
      setTimeout(() => {
        const recorridoEditado = this.recorridos().find(r => r.id === data.recorridoId);
        
        if (recorridoEditado && rutaViendo === recorridoEditado.ruta_id) {
          if (data.estado === 'Activa') {
            console.log('🚀 Ruta en pantalla acaba de iniciar, conectando a sockets...');
            if (this.recorridoActivoId) {
              this.webSocketService.salirRecorrido(this.recorridoActivoId);
            }
            this.recorridoActivoId = data.recorridoId;
            this.webSocketService.unirseRecorrido(data.recorridoId);
          } else if (data.estado === 'Finalizado' || data.estado === 'Cancelado') {
            console.log('🛑 Ruta en pantalla finalizó, desconectando...');
            this.mapService.clearDriverMarker();
            if (this.recorridoActivoId) {
              this.webSocketService.salirRecorrido(this.recorridoActivoId);
              this.recorridoActivoId = null;
            }
          }
        }
      }, 500); // 500ms para dar tiempo a la respuesta HTTP de cargarRecorridos
    });
  }

  // ---------------------------------------------------------
  // CARGAR RUTAS
  // ---------------------------------------------------------
  cargarRutas() {
    this.rutasService.getRutas().subscribe({
      
      next: (resp: any) => {
        console.log("📥 Rutas recibidas:", resp);

        const data = Array.isArray(resp.data) ? resp.data : [];

        this.rutas.set(data);

        console.log("📦 Rutas almacenadas en signal:", this.rutas());
      },

      error: (err) => {
        console.error('❌ Error cargando rutas', err);
        this.rutas.set([]);
      },
    });
  }

  // ---------------------------------------------------------
  // SELECCIONAR RUTA DESDE EL SELECT
  // ---------------------------------------------------------
  seleccionarRuta(event: Event) {
  const target = event.target as HTMLSelectElement;
  const rutaId = target.value; // UUID string

  this.rutaSeleccionada.set(rutaId);

  if (!rutaId) {
    console.log("↩ No se seleccionó ruta — limpiando mapa");
    this.mapService.resetMap();
    this.mapService.clearDriverMarker();
    if (this.recorridoActivoId) {
      this.webSocketService.salirRecorrido(this.recorridoActivoId);
      this.recorridoActivoId = null;
    }
    return;
  }

  console.log("📌 Ruta seleccionada:", rutaId);

  // Buscar en rutas cargadas
  const ruta = this.rutas().find(r => r.id === rutaId);

  if (!ruta) {
    console.error("❌ No se encontró la ruta en la lista cargada:", rutaId);
    return;
  }

  console.log("📄 Ruta encontrada:", ruta);

  if (!ruta.shape) {
    console.error("❌ Esta ruta no tiene shape:", ruta);
    return;
  }

  // Parsear shape
  let shape;
  try {
    shape = JSON.parse(ruta.shape);
  } catch (e) {
    console.error("❌ Error parseando shape:", e, ruta.shape);
    return;
  }

  // ✅ Enviar al servicio para mostrar en el mapa
  let coords: [number, number][] = [];

  if (shape.type === "LineString") {
    coords = shape.coordinates;
  } else if (shape.type === "MultiLineString") {
    // Para MultiLineString tomamos la primera línea (o podrías combinar todas)
    coords = shape.coordinates.flat();
  } else {
    console.error("❌ Tipo de geometría no soportado:", shape.type);
    return;
  }

  console.log("🗺 Coordenadas enviadas al mapa:", coords);

  this.mapService.showRoute(coords);

  // Buscar si hay un recorrido activo para esta ruta
  const recorridoActivo = this.recorridos().find(r => r.ruta_id === rutaId && r.estado === 'Activa');
  
  // Salir del recorrido anterior si existe
  if (this.recorridoActivoId && this.recorridoActivoId !== recorridoActivo?.id) {
    this.webSocketService.salirRecorrido(this.recorridoActivoId);
    this.recorridoActivoId = null;
    this.mapService.clearDriverMarker();
  }

  // Unirse al nuevo recorrido activo
  if (recorridoActivo) {
    console.log("🚀 Recorrido activo encontrado, conectando a WebSockets:", recorridoActivo.id);
    this.recorridoActivoId = recorridoActivo.id;
    this.webSocketService.unirseRecorrido(recorridoActivo.id);
  } else {
    console.log("⏳ No hay recorridos activos para esta ruta.");
    this.mapService.clearDriverMarker();
  }
  }


  // ---------------------------------------------------------
  // VEHÍCULOS
  // ---------------------------------------------------------
  cargarVehiculos() {
    this.vehiculosService.getVehiculos().subscribe({
      next: (resp: any) => {
        console.log('📥 Vehículos:', resp);
        const arr = Array.isArray(resp) ? resp : (resp.data || []);
        this.vehiculos.set(arr);
        if (arr.length > 0) this.vehiculoSeleccionado.set(arr[0]);
        this.actualizarStats();
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

  cargarRecorridos() {
    this.recorridosService.getRecorridos().subscribe({
      next: (resp: any) => {
        console.log('📥 Recorridos RAW (crudo del backend):', JSON.stringify(resp));
        const arr: Recorrido[] = Array.isArray(resp) ? resp : (resp.data || []);
        console.log('📦 Recorridos parseados:', arr);
        if (arr.length > 0) {
          console.log('🔍 Ejemplo primer recorrido, campos:', Object.keys(arr[0]));
          console.log('🔍 Primer recorrido completo:', JSON.stringify(arr[0]));
        }
        console.log('👥 Conductores cargados:', this.conductores());
        console.log('🚗 Vehículos cargados:', this.vehiculos());
        
        this.recorridos.set(arr);
        this.actualizarStats();
      },
      error: (err) => {
        console.error('❌ Error cargando recorridos:', err);
        this.recorridos.set([]);
      }
    });
  }

  getDetalleRuta(rutaId: string) {
    const ruta = this.rutas().find(ru => ru.id === rutaId);
    return ruta?.nombre_ruta || 'Ruta sin nombre';
  }

  getDetalleConductor(conductorId: string) {
    const conductor = this.conductores().find(c => c.id === conductorId);
    return conductor ? `${conductor.primerNombre || ''} ${conductor.primerApellido || ''}`.trim() : 'Sin asignar';
  }

  getDetalleVehiculo(vehiculoId: string) {
    const vehiculo = this.vehiculos().find(v => v.id === vehiculoId);
    return vehiculo ? vehiculo.placa : 'No especificado';
  }

  actualizarStats() {
    const vehiculosActivos = this.vehiculos().filter(v => v.activo).length;
    const rutasCompletadas = this.recorridos().filter(r => r.estado === 'completado' || r.estado === 'finalizado').length;
    const rutasActivas = this.recorridos().filter(r => 
      ['activo', 'en_curso', 'programado', 'asignado', 'iniciado', 'pendiente'].includes(r.estado)
    ).length;
    this.stats.set({ vehiculosActivos, rutasCompletadas, rutasActivas });
  }

  // --- FULLSCREEN MAP ---
  toggleMapFullscreen() {
    this.mapFullscreen.update(v => !v);
    setTimeout(() => this.mapService.resizeMap(), 300); // trigger resize after CSS transition
  }

  toggleSidebar() { 
    this.sidebarOpen.update(v => !v);
    // Redimensionar el mapa cuando el sidebar cambia de estado
    this.mapService.resizeMap();
  }
  seleccionarVehiculo(v: Vehiculo) { this.vehiculoSeleccionado.set(v); }

  abrirModalRegistrarRuta() { 
    this.formRuta.set({ nombre: '', zona: '', horario: '' }); 
    this.showRegistrarRutaModal.set(true); 
  }
  cerrarModalRegistrarRuta() { 
    this.showRegistrarRutaModal.set(false); 
  }
  trazarRuta() { 
    this.showRouteTools.set(true); 
    this.showRegistrarRutaModal.set(false); 
  }

  abrirModalRegistrarVehiculo() { 
    this.formVehiculo.set({ placa: '', modelo: '', marca: '', activo: true }); 
    this.showRegistrarVehiculoModal.set(true); 
  }
  cerrarModalRegistrarVehiculo() { 
    this.showRegistrarVehiculoModal.set(false); 
  }

  abrirModalIngresarDireccion() { 
    this.formDireccion.set({ rutaId: this.rutas()[0]?.id || '', direccion: '', orden: 1 });
    this.showIngresarDireccionModal.set(true); 
  }

  cerrarModalIngresarDireccion() { this.showIngresarDireccionModal.set(false); }

  irAConductores() {
    this.router.navigate(['/conductores']);
  }

  guardarRuta() {
    const form = this.formRuta();
    if (!form.nombre || !form.zona || !form.horario) { alert('Completa todos los campos'); return; }
    this.rutasService.guardarRuta({ 
      nombre: form.nombre, 
      zona: form.zona, 
      horario: form.horario, 
      estado: 'programada' }).subscribe({
      next: () => { 
        this.cargarRutas(); 
        this.cerrarModalRegistrarRuta(); 
      },
      error: () => alert('Error guardando ruta')
    });
  }

  guardarVehiculo() {
    const form = this.formVehiculo();

    if (!form.placa || !form.modelo || !form.marca) { 
      alert('Completa todos los campos'); 
      return; 
    }

    this.vehiculosService.registrarVehiculo(form, ).subscribe({
      next: () => { 
        this.cargarVehiculos(); 
        this.cerrarModalRegistrarVehiculo(); 
      },
      error: () => alert('Error registrando vehículo')
    });
  }

  guardarDireccion() {
    const form = this.formDireccion();

    if (!form.direccion || !form.rutaId) { 
      alert('Completa todos los campos'); 
      return; 
    }

    this.cerrarModalIngresarDireccion();
  }
  
}
