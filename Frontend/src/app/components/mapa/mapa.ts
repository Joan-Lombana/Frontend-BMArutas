import { Component, AfterViewInit, Input, OnChanges, SimpleChanges} from '@angular/core';
import { LeafletMapService } from '../../services/leaflet-map.services';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [],
  templateUrl: './mapa.html',
  styleUrls: ['./mapa.scss'],
})
export class MapaComponent implements AfterViewInit, OnChanges {

  private rutasUrl = `${environment.apiUrl}/operativo/rutas`;
  @Input() recorridos: any[] = [];
  @Input() rutas: any[] = [];
  private mapReady = false;
  constructor(
    private mapService: LeafletMapService,
    private http: HttpClient
  ) {}

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.mapService.initMap('map');
      this.mapReady = true;
      this.renderRecorridos();
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['recorridos'] && this.mapReady) {
      this.renderRecorridos();
    }
  }

  private renderRecorridos(): void {
    if (!this.recorridos?.length) return;

    this.recorridos.forEach((recorrido) => {
      const ruta = recorrido?.ruta;
      if (!ruta?.shape) return;

      const estado = (recorrido.estado || '').toLowerCase();
      if (!['programada', 'programado', 'activa', 'activo', 'pausado'].includes(estado)) return;

      try {
        const shape = JSON.parse(ruta.shape);
        let coords: [number, number][] = [];

        if (shape.type === 'LineString') {
          coords = shape.coordinates;
        }

        if (shape.type === 'MultiLineString') {
          coords = shape.coordinates.flat();
        }

        if (coords.length < 2) return;

        this.mapService.showLiveRoute(
          recorrido.id,
          coords,
          this.mapService.getColorByEstado(recorrido.estado)
        );
        this.mapService.setRouteEndpoints(recorrido.id, coords);
      } catch (e) {
        console.error('❌ Error shape recorrido:', e);
      }
    });
  }
}

