import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { HeaderComponent } from '../../components/header/header';
import { SidebarComponent } from '../../components/sidebar/sidebar';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.services';
import { catchError, of } from 'rxjs';

interface Incidencia {
  id: string;
  recorrido_id: string | null;
  recorrido?: any; // Datos del recorrido (conductor, ruta, etc)
  tipo: string;
  descripcion: string;
  foto?: string | null;
  timestamp: number;
  createdAt?: string;
}

@Component({
  selector: 'app-incidencias',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, SidebarComponent],
  templateUrl: './incidencias.html',
  styleUrls: ['./incidencias.scss']
})
export class IncidenciasComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  sidebarOpen = signal(true);
  incidencias = signal<Incidencia[]>([]);
  cargando = signal(true);
  error = signal(false);

  // Filtros
  filtroTipo = signal('');
  busqueda = signal('');

  // Modal detalle
  incidenciaSeleccionada = signal<Incidencia | null>(null);

  tiposIncidencia = [
    { value: '', label: 'Todos los tipos' },
    { value: 'Mechanic', label: 'Falla Mecánica' },
    { value: 'Blocked', label: 'Vía Obstruida' },
    { value: 'Access', label: 'Zona Inaccesible' },
    { value: 'Accident', label: 'Accidente' },
    { value: 'Otro', label: 'Otro' },
  ];

  private pollInterval: any;

  ngOnInit() {
    this.cargarIncidencias();
    // Refresco automático cada 10 segundos
    this.pollInterval = setInterval(() => {
      this.cargarIncidencias(false); // false para que no muestre el spinner de carga cada vez
    }, 10000);
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  cargarIncidencias(mostrarCargando = true) {
    if (mostrarCargando) this.cargando.set(true);
    this.error.set(false);

    this.http.get<Incidencia[]>(`${environment.apiUrl}/operativo/incidencias`, this.auth.getAuthHeaders())
      .pipe(
        catchError(err => {
          console.error('❌ Error cargando incidencias:', err);
          this.error.set(true);
          return of([]);
        })
      )
      .subscribe(resp => {
        this.incidencias.set(resp || []);
        this.cargando.set(false);
      });
  }

  getIncidenciasFiltradas(): Incidencia[] {
    let lista = this.incidencias();
    const tipo = this.filtroTipo();
    const texto = this.busqueda().toLowerCase();

    if (tipo) lista = lista.filter(i => i.tipo === tipo);
    if (texto) lista = lista.filter(i =>
      i.tipo.toLowerCase().includes(texto) ||
      i.descripcion?.toLowerCase().includes(texto) ||
      i.recorrido?.conductor_id?.toLowerCase().includes(texto)
    );

    // Ordenar por fecha (el más reciente primero)
    return lista.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.timestamp || 0).getTime();
      const dateB = new Date(b.createdAt || b.timestamp || 0).getTime();
      return dateB - dateA;
    });
  }

  getLabelTipo(tipo: string): string {
    const map: Record<string, string> = {
      Mechanic: 'Falla Mecánica',
      Blocked: 'Vía Obstruida',
      Access: 'Zona Inaccesible',
      Accident: 'Accidente',
      Otro: 'Otro'
    };
    return map[tipo] ?? tipo;
  }

  getIconTipo(tipo: string): string {
    const map: Record<string, string> = {
      Mechanic: 'fa-wrench',
      Blocked: 'fa-ban',
      Access: 'fa-map-location-dot',
      Accident: 'fa-car-burst',
      Otro: 'fa-ellipsis'
    };
    return map[tipo] ?? 'fa-triangle-exclamation';
  }

  getColorTipo(tipo: string): string {
    const map: Record<string, string> = {
      Mechanic: 'warning',
      Blocked: 'danger',
      Access: 'info',
      Accident: 'danger',
      Otro: 'gray'
    };
    return map[tipo] ?? 'gray';
  }

  formatFecha(item: Incidencia): string {
    const fechaRaw = item.createdAt || item.timestamp;
    if (!fechaRaw) return '—';
    
    const d = new Date(fechaRaw);
    if (isNaN(d.getTime())) return '—';

    return d.toLocaleString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  abrirDetalle(i: Incidencia) {
    this.incidenciaSeleccionada.set(i);
  }

  cerrarDetalle() {
    this.incidenciaSeleccionada.set(null);
  }
}
