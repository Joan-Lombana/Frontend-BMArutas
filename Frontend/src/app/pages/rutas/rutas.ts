import {
  Component,
  signal,
  OnInit,
  OnDestroy,
  DestroyRef,
  inject,
} from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { HeaderComponent } from '../../components/header/header';
import { SidebarComponent } from '../../components/sidebar/sidebar';

import { RutasService } from '../../services/rutas.services';
import { VehiculosService } from '../../services/vehiculos.services';
import { UsuariosService } from '../../services/usuarios.services';
import { RecorridosService } from '../../services/recorridos.services';
import { WebSocketService } from '../../services/websocket.service';

interface Ruta {
  id: string;
  nombre_ruta: string;
  horario: string;
  zona: string;
  estado: string;
}

@Component({
  selector: 'app-rutas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderComponent,
    SidebarComponent,
  ],
  templateUrl: './rutas.html',
  styleUrls: ['./rutas.scss'],
})
export class RutasComponent implements OnInit, OnDestroy {

  // =========================
  // SERVICES
  // =========================

  private rutasService = inject(RutasService);
  private vehiculosService = inject(VehiculosService);
  private usuariosService = inject(UsuariosService);
  private recorridosService = inject(RecorridosService);
  private webSocketService = inject(WebSocketService);

  private destroyRef = inject(DestroyRef);

  // =========================
  // SIGNALS
  // =========================

  sidebarOpen = signal(true);

  rutas = signal<Ruta[]>([]);
  recorridos = signal<any[]>([]);

  vehiculosActivos = signal<any[]>([]);
  conductores = signal<any[]>([]);

  filtrarEstado = signal<string>('');
  buscarRuta = signal<string>('');

  editando = signal<Ruta | null>(null);

  rutaAProgramar = signal<Ruta | null>(null);

  formRecorrido = signal({
    vehiculo_id: '',
    conductor_id: '',
    fecha_programada: '',
  });

  // =========================
  // CONTROL DE SALAS
  // =========================

  salasUnidas = new Set<string>();

  // =========================
  // INIT
  // =========================

  ngOnInit() {

    this.cargarRutas();
    this.cargarDatosDesplegables();
    this.cargarRecorridos();

    this.configurarWebSocket();
  }

  ngOnDestroy(): void {

    this.salasUnidas.forEach((id) => {

      this.webSocketService.salirRecorrido(id);

    });
  }

  // =========================
  // WEBSOCKET
  // =========================

  configurarWebSocket() {

    // =========================
    // ESTADO RECORRIDO
    // =========================

    this.webSocketService
      .onEstadoRecorrido()
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((data: any) => {

        console.log('📡 Estado actualizado:', data);

        this.recorridos.update((recorridos) =>
          recorridos.map((r) =>
            r.id === data.recorridoId
              ? {
                  ...r,
                  estado: data.estado,
                }
              : r
          )
        );
      });

    // =========================
    // RECORRIDO ELIMINADO
    // =========================

    this.webSocketService
      .onRecorridoEliminado()
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((data: any) => {

        console.log('🗑️ Recorrido eliminado:', data);

        this.recorridos.update((recorridos) =>
          recorridos.filter(
            (r) => r.id !== data.recorridoId
          )
        );

        this.salasUnidas.delete(data.recorridoId);
      });

    // =========================
    // NUEVA POSICIÓN
    // =========================

    this.webSocketService
      .onPosicion()
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((data: any) => {

        console.log('📍 Nueva posición:', data);

        // 🔥 aquí luego actualizarás el mapa
      });

    // =========================
    // POSICIÓN ACTUALIZADA
    // =========================

    this.webSocketService
      .onPosicionActualizada()
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((data: any) => {

        console.log('✏️ Posición actualizada:', data);

      });
  }

  // =========================
  // RECORRIDOS
  // =========================

  cargarRecorridos() {

    this.recorridosService.getRecorridos().subscribe({

      next: (resp: any) => {

        const arr = Array.isArray(resp)
          ? resp
          : (resp.data || []);

        console.log('🛣️ Recorridos cargados:', arr.length);

        this.recorridos.set(arr);

        // Unirse a salas
        arr.forEach((recorrido: any) => {

          const estado = (recorrido.estado || '')
            .toString()
            .toLowerCase();

          if (
            ['programada', 'activa', 'pausado'].includes(estado) &&
            !this.salasUnidas.has(recorrido.id)
          ) {

            this.webSocketService.unirseRecorrido(recorrido.id);

            this.salasUnidas.add(recorrido.id);

            console.log('🛰️ Unido a sala:', recorrido.id);
          }
        });
      },

      error: (err) => {
        console.error('❌ Error cargando recorridos:', err);
      },
    });
  }

  getRecorridoActivo(rutaId: string) {

    return this.recorridos().find((r) => {

      const estado = (r.estado || '')
        .toString()
        .toLowerCase();

      return (
        String(r.ruta_id) === String(rutaId) &&
        ['programada', 'activa', 'pausado'].includes(estado)
      );
    });
  }

  // =========================
  // NOMBRES
  // =========================

  getNombreConductor(conductorId: string) {

    const c = this.conductores()
      .find((x) => x.id === conductorId);

    return c
      ? `${c.primerNombre || ''} ${c.primerApellido || ''}`
      : 'Conductor';
  }

  getNombreVehiculo(vehiculoId: string) {

    const v = this.vehiculosActivos()
      .find((x) => x.id === vehiculoId);

    return v
      ? `${v.placa}`
      : 'Vehículo';
  }

  getNombreConductorPorRuta(rutaId: string) {

    const rec = this.getRecorridoActivo(rutaId);

    return rec?.conductor_id
      ? this.getNombreConductor(rec.conductor_id)
      : '';
  }

  getNombreVehiculoPorRuta(rutaId: string) {

    const rec = this.getRecorridoActivo(rutaId);

    return rec?.vehiculo_id
      ? this.getNombreVehiculo(rec.vehiculo_id)
      : '';
  }

  // =========================
  // ESTADO RUTA
  // =========================

  getEstadoRuta(ruta: Ruta) {

    const rec = this.getRecorridoActivo(ruta.id);

    if (!rec) {
      return 'no programada';
    }

    const estado = (rec.estado ?? '')
      .toString()
      .toLowerCase()
      .trim();

    const estadosValidos = [
      'programada',
      'activa',
      'pausado',
      'finalizado',
      'cancelado',
    ];

    return estadosValidos.includes(estado)
      ? estado
      : 'no programada';
  }

  getEstadoRutaLabel(ruta: Ruta) {

    const estado = this.getEstadoRuta(ruta);

    if (estado === 'activa') {
      return 'En curso';
    }

    if (estado === 'no programada') {
      return 'No programada';
    }

    return estado.charAt(0).toUpperCase() + estado.slice(1);
  }

  isProgramada(ruta: Ruta): boolean {

    const rec = this.getRecorridoActivo(ruta.id);

    return (rec?.estado ?? '')
      .toString()
      .toLowerCase() === 'programada';
  }

  isActiva(ruta: Ruta): boolean {

    const rec = this.getRecorridoActivo(ruta.id);

    return (rec?.estado ?? '')
      .toString()
      .toLowerCase() === 'activa';
  }

  isPausado(ruta: Ruta): boolean {

    const rec = this.getRecorridoActivo(ruta.id);

    return (rec?.estado ?? '')
      .toString()
      .toLowerCase() === 'pausado';
  }

  // =========================
  // FILTROS
  // =========================

  getRutasFiltradas() {

    const estadoFiltro = this.filtrarEstado()
      .trim()
      .toLowerCase();

    const busqueda = this.buscarRuta()
      .trim()
      .toLowerCase();

    return this.rutas().filter((ruta) => {

      const estadoRuta = this.getEstadoRuta(ruta)
        .toLowerCase();

      const aplicarEstado =
        !estadoFiltro ||
        estadoRuta === estadoFiltro;

      const aplicarBusqueda =
        !busqueda ||
        ruta.nombre_ruta
          .toLowerCase()
          .includes(busqueda);

      return aplicarEstado && aplicarBusqueda;
    });
  }

  // =========================
  // CARGA DATOS
  // =========================

  cargarDatosDesplegables() {

    this.vehiculosService.getVehiculos().subscribe({

      next: (resp: any) => {

        const arr = Array.isArray(resp)
          ? resp
          : (resp.data || []);

        this.vehiculosActivos.set(
          arr.filter((v: any) => v.activo)
        );
      },
    });

    this.usuariosService.getUsuarios().subscribe({

      next: (resp: any) => {

        const arr = Array.isArray(resp)
          ? resp
          : (resp.data || []);

        this.conductores.set(

          arr.filter(
            (u: any) =>
              u.activo &&
              u.perfil?.rol?.tipo === 'conductor'
          )
        );
      },
    });
  }

  cargarRutas() {

    this.rutasService.getRutas().subscribe({

      next: (resp: any) => {

        const arr = Array.isArray(resp)
          ? resp
          : (resp.data || resp.rutas || []);

        this.rutas.set(arr);
      },

      error: () => {
        this.rutas.set([]);
      },
    });
  }

  // =========================
  // UI
  // =========================

  toggleSidebar() {
    this.sidebarOpen.update((v) => !v);
  }

  // =========================
  // ELIMINAR RUTA
  // =========================

  eliminarRuta(ruta: Ruta) {

    if (
      confirm(`¿Eliminar ruta "${ruta.nombre_ruta}"?`)
    ) {

      this.rutasService.eliminarRuta(ruta.id).subscribe({

        next: () => {
          this.cargarRutas();
        },

        error: () => {
          alert('Error eliminando ruta');
        },
      });
    }
  }

  // =========================
  // EDITAR
  // =========================

  editarRuta(ruta: Ruta) {
    this.editando.set({ ...ruta });
  }

  cancelarEdicion() {
    this.editando.set(null);
  }

  guardarEdicion() {

    const ruta = this.editando();

    if (!ruta) return;

    this.rutasService
      .actualizarRuta(ruta.id, ruta)
      .subscribe({

        next: () => {

          this.editando.set(null);

          this.cargarRutas();
        },

        error: () => {
          alert('Error actualizando ruta');
        },
      });
  }

  // =========================
  // PROGRAMAR
  // =========================

  abrirModalProgramar(ruta: Ruta) {

    this.rutaAProgramar.set(ruta);

    this.formRecorrido.set({
      vehiculo_id: '',
      conductor_id: '',
      fecha_programada: '',
    });
  }

  cerrarModalProgramar() {
    this.rutaAProgramar.set(null);
  }

  guardarPrograma() {

    const r = this.rutaAProgramar();
    const f = this.formRecorrido();

    if (
      !r ||
      !f.vehiculo_id ||
      !f.conductor_id ||
      !f.fecha_programada
    ) {

      alert(
        'Rellena todos los campos para programar el recorrido.'
      );

      return;
    }

    let fechaISO = '';

    try {

      fechaISO = new Date(
        f.fecha_programada
      ).toISOString();

    } catch {

      alert('Fecha inválida');

      return;
    }

    const payload = {
      ruta_id: r.id,
      vehiculo_id: f.vehiculo_id,
      conductor_id: f.conductor_id,
      fecha_programada: fechaISO,
    };

    this.recorridosService
      .programarRecorrido(payload)
      .subscribe({

        next: (response: any) => {

          this.cerrarModalProgramar();

          this.cargarRutas();
          this.cargarRecorridos();

          if (
            response?.id &&
            !this.salasUnidas.has(response.id)
          ) {

            this.webSocketService.unirseRecorrido(
              response.id
            );

            this.salasUnidas.add(response.id);
          }

          alert(
            '🚌 Recorrido programado exitosamente'
          );
        },

        error: (err) => {

          console.error(
            '❌ Error backend:',
            err
          );

          alert(
            'Error programando el recorrido'
          );
        },
      });
  }

  // =========================
  // CANCELAR
  // =========================

  cancelarRecorrido(ruta: Ruta) {

    const rec = this.getRecorridoActivo(ruta.id);

    if (
      rec &&
      confirm(
        '¿Cancelar el recorrido programado?'
      )
    ) {

      this.recorridosService
        .eliminarRecorrido(rec.id)
        .subscribe({

          next: () => {

            this.webSocketService
              .salirRecorrido(rec.id);

            this.salasUnidas.delete(rec.id);

            this.recorridos.update(
              (recorridos) =>
                recorridos.filter(
                  (r) => r.id !== rec.id
                )
            );

            alert(
              'Recorrido cancelado exitosamente'
            );
          },

          error: () => {
            alert(
              'Error cancelando el recorrido'
            );
          },
        });
    }
  }

  // =========================
  // VISUALIZAR
  // =========================

  visualizarRuta(ruta: Ruta) {
    console.log('👁️ Visualizar:', ruta);
  }
}
