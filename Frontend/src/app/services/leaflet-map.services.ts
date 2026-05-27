import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { HttpClient } from '@angular/common/http';
import * as GeoJSON from 'geojson';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class LeafletMapService {
  
  // MAPA BASE
  private map: L.Map | null = null;
  private routeCreated = false;

  // VEHÍCULOS
  private vehicleMarker: L.Marker | null = null;
  private vehiculos = new Map<string, L.Marker>();

  // RUTAS / RECORRIDOS
  private waypoints: L.LatLng[] = [];
  private pointLayers: L.Layer[] = [];
  private routeLayer: L.GeoJSON | null = null;
  private currentRouteLayer: L.GeoJSON | null = null;
  private rutasActivas = new Map<string, L.GeoJSON>();

  // INICIO / FIN MARKERS
  private inicioMarkers = new Map<string, L.Layer>();
  private finMarkers = new Map<string, L.Layer>();

  private startIcon = L.divIcon({
    html: '<div style="width:28px;height:28px;border-radius:50%;background:#00c853;border:4px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:700;font-size:14px;">I</div>',
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  private endIcon = L.divIcon({
    html: '<div style="width:28px;height:28px;border-radius:50%;background:#f44336;border:4px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:700;font-size:14px;">F</div>',
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  private MAPBOX_TOKEN = environment.mapboxToken;

  constructor(private http: HttpClient) {}

  // INICIAR MAPA
  initMap(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (this.map && this.map.getContainer() !== container) {
      this.map.remove();
      this.map = null;
    }

    if (!this.map) {
      this.map = L.map(containerId).setView([3.8801, -77.0312], 14);

      L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${this.MAPBOX_TOKEN}`,
        { tileSize: 512, zoomOffset: -1 }
      ).addTo(this.map);
    }

    setTimeout(() => this.map!.invalidateSize(), 200);
  }

  resizeMap() {
    if (!this.map) return;
    setTimeout(() => this.map!.invalidateSize(), 100);
  }

  isRouteCreated() {
    return this.routeCreated;
  }

  getRouteGeoJSON(): GeoJSON.LineString | null {
    if (!this.routeLayer) return null;

    const geojson = this.routeLayer.toGeoJSON() as GeoJSON.FeatureCollection;
    const feature = geojson.features[0];

    if (!feature || feature.geometry.type !== 'LineString') return null;

    return feature.geometry as GeoJSON.LineString;
  }

  // =========================================================
  // SELECCIÓN DE PUNTOS
  // =========================================================
  enablePointSelection() {
    if (!this.map) return;

    this.waypoints = [];
    this.clearMarkers();
    this.routeCreated = false;

    this.map.dragging.disable();
    this.map.getContainer().style.cursor = 'crosshair';

    this.map.on('click', this.selectPoint);

    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
  }

  disablePointSelection() {
    if (!this.map) return;

    this.map.dragging.enable();
    this.map.getContainer().style.cursor = 'grab';
    this.map.off('click', this.selectPoint);
  }

  private selectPoint = (e: L.LeafletMouseEvent) => {
    this.waypoints.push(e.latlng);

    const point = L.circleMarker(e.latlng, {
      radius: 6,
      color: '#3917d3ff',
      fillColor: '#ff6600',
      fillOpacity: 1,
    }).addTo(this.map!);

    this.pointLayers.push(point);
  };

  undoLastPoint() {
    if (!this.map) return;

    if (this.routeCreated) {
      this.resetAll();
      return;
    }

    const last = this.pointLayers.pop();
    if (last) this.map.removeLayer(last);

    this.waypoints.pop();
  }

  // =========================================================
  // RUTA MAPBOX
  // =========================================================
  createRoute() {
    if (this.waypoints.length < 2 || !this.map) return;

    const coords = this.waypoints.map(p => `${p.lng},${p.lat}`).join(';');

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${this.MAPBOX_TOKEN}`;

    this.http.get<any>(url).subscribe(resp => {
      const geometry = resp.routes[0].geometry;

      if (this.routeLayer) this.map!.removeLayer(this.routeLayer);

      this.routeLayer = L.geoJSON(geometry, {
        style: { color: '#007BFF', weight: 4 }
      }).addTo(this.map!);

      this.routeCreated = true;
      this.clearMarkers();
    });
  }

  // =========================================================
  // LIMPIEZA
  // =========================================================
  private clearMarkers() {
    this.pointLayers.forEach(l => this.map?.removeLayer(l));
    this.pointLayers = [];
  }

  private clearRouteEndpoints() {
    this.inicioMarkers.forEach(m => this.map?.removeLayer(m));
    this.finMarkers.forEach(m => this.map?.removeLayer(m));

    this.inicioMarkers.clear();
    this.finMarkers.clear();
  }

  private resetAll() {
    if (!this.map) return;

    this.routeLayer && this.map.removeLayer(this.routeLayer);
    this.currentRouteLayer && this.map.removeLayer(this.currentRouteLayer);

    this.clearMarkers();
    this.clearRouteEndpoints();
    this.waypoints = [];
    this.routeCreated = false;
  }

  resetMap() {
    this.resetAll();
  }

  // =========================================================
  // RUTA ESTÁTICA
  // =========================================================
  showRoute(coordinates: [number, number][], id: string = 'static-route') {
  if (!this.map || coordinates.length < 2) return;

  this.clearLiveRoutes();

  if (this.currentRouteLayer) {
    this.map.removeLayer(this.currentRouteLayer);
  }

  const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates }
  };

  this.currentRouteLayer = L.geoJSON(geojson, {
    style: {
      color: '#007BFF',
      weight: 5
    }
  }).addTo(this.map);

  const bounds = coordinates.map(c => [c[1], c[0]] as [number, number]);
  this.map.fitBounds(bounds);

  // 🔥 NUEVO: endpoints visibles también en ruta seleccionada
  this.setRouteEndpoints(id, coordinates);
}

  // =========================================================
  // RUTA EN VIVO (SOLO ACTIVA / PROGRAMADA)
  // =========================================================
  showLiveRoute(
    recorridoId: string,
    coordinates: [number, number][],
    color: string = '#00C853'
  ) {
    if (!this.map || coordinates.length < 2) return;

    const existente = this.rutasActivas.get(recorridoId);
    if (existente) this.map.removeLayer(existente);

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates }
    };

    const layer = L.geoJSON(geojson, {
      style: { color, weight: 4, opacity: 0.8 }
    }).addTo(this.map);

    this.rutasActivas.set(recorridoId, layer);
  }

  removerRutaViva(recorridoId: string) {
    const layer = this.rutasActivas.get(recorridoId);
    if (layer) {
      this.map?.removeLayer(layer);
      this.rutasActivas.delete(recorridoId);
    }

    const inicio = this.inicioMarkers.get(recorridoId);
    const fin = this.finMarkers.get(recorridoId);
    if (inicio) { this.map?.removeLayer(inicio); this.inicioMarkers.delete(recorridoId); }
    if (fin) { this.map?.removeLayer(fin); this.finMarkers.delete(recorridoId); }
  }

  clearLiveRoutes() {
  if (!this.map) return;

  this.rutasActivas.forEach(l => this.map!.removeLayer(l));
  this.rutasActivas.clear();

  this.clearRouteEndpoints();
}

  // =========================================================
  // VEHÍCULOS
  // =========================================================
  actualizarVehiculo(
    recorridoId: string,
    lat: number,
    lng: number,
    info?: { ruta?: string; conductor?: string; placa?: string }
  ) {
    const existe = this.vehiculos.get(recorridoId);
    const tooltip = this.crearTooltipVehiculo(info);

    if (existe) {
      existe.setLatLng([lat, lng]);
      existe.bindTooltip(tooltip, {
        direction: 'top',
        offset: [0, -18],
        sticky: true,
        opacity: 0.95
      });
      return;
    }

    const marker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'truck.png',
        iconSize: [35, 35],
        iconAnchor: [17, 17]
      })
    }).addTo(this.map!);

    marker.bindTooltip(tooltip, {
      direction: 'top',
      offset: [0, -18],
      sticky: true,
      opacity: 0.95
    });

    this.vehiculos.set(recorridoId, marker);
  }

  private crearTooltipVehiculo(info?: { ruta?: string; conductor?: string; placa?: string }) {
    const ruta = info?.ruta || 'Ruta no identificada';
    const conductor = info?.conductor || 'Conductor no identificado';
    const placa = info?.placa || 'Placa no identificada';

    return `
      <div style="font-size:12px;line-height:1.35;">
        <strong>Ruta:</strong> ${ruta}<br>
        <strong>Conductor:</strong> ${conductor}<br>
        <strong>Vehículo:</strong> ${placa}
      </div>
    `;
  }

  removerVehiculo(recorridoId: string) {
    const marker = this.vehiculos.get(recorridoId);

    if (!marker) return;

    this.map?.removeLayer(marker);
    this.vehiculos.delete(recorridoId);
  }

  // =========================================================
  // FILTRO Y RENDER (SOLO ACTIVO / PROGRAMADO)
  // =========================================================
  renderRecorridos(recorridos: any[]) {
    if (!this.map || !recorridos) return;

    this.clearLiveRoutes();

    recorridos
      .filter(r => {
        const e = (r.estado || '').toLowerCase();
        return e === 'activo' || e === 'programada';
      })
      .forEach(r => {

        if (!r.coordenadas || r.coordenadas.length < 2) return;

        const color = this.getColorByEstado(r.estado);

        this.showLiveRoute(r.id, r.coordenadas, color);
        this.setRouteEndpoints(r.id, r.coordenadas);
      });
  }
  // ENDPOINTS (INICIO / FIN)
  setRouteEndpoints(recorridoId: string, coordinates: [number, number][]) {
    if (!this.map || coordinates.length < 2) return;

    const start = coordinates[0];
    const end = coordinates[coordinates.length - 1];

    const oldStart = this.inicioMarkers.get(recorridoId);
    const oldEnd = this.finMarkers.get(recorridoId);

    if (oldStart) this.map.removeLayer(oldStart);
    if (oldEnd) this.map.removeLayer(oldEnd);

    const startMarker = L.circleMarker([start[1], start[0]], {
      radius: 10,
      color: '#ffffff',
      weight: 4,
      fillColor: '#00c853',
      fillOpacity: 1
    }).bindTooltip('I', {
      permanent: true,
      direction: 'center',
      className: 'route-endpoint-label'
    }).addTo(this.map);

    const endMarker = L.circleMarker([end[1], end[0]], {
      radius: 10,
      color: '#ffffff',
      weight: 4,
      fillColor: '#f44336',
      fillOpacity: 1
    }).bindTooltip('F', {
      permanent: true,
      direction: 'center',
      className: 'route-endpoint-label'
    }).addTo(this.map);

    this.inicioMarkers.set(recorridoId, startMarker);
    this.finMarkers.set(recorridoId, endMarker);
  }

  // SYNC GLOBAL
  syncMapa(recorridos: any[], rutaSeleccionada?: any) {
    this.clearLiveRoutes();

    recorridos.forEach(r => {
      if (r.coordenadas?.length > 1) {
        this.showLiveRoute(r.id, r.coordenadas, this.getColorByEstado(r.estado));
        this.setRouteEndpoints(r.id, r.coordenadas);
      }
    });

    if (rutaSeleccionada?.coordenadas) {
      this.showRoute(rutaSeleccionada.coordenadas);
    }
  }

  // COLORES
  getColorByEstado(estado: string): string {
    const e = (estado || '').toLowerCase();

    switch (e) {
      case 'activo':
      case 'activa':
        return '#00C853';

      case 'programado':
      case 'programada':
        return '#FF9800';

      case 'pausado':
        return '#FBC02D';

      default:
        return '#9E9E9E';
    }
  }
}






