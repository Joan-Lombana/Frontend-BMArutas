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
  private liveGroup: L.FeatureGroup = L.featureGroup();
  private drawGroup: L.FeatureGroup = L.featureGroup();
  private currentMode: 'live' | 'draw' = 'live';

  // VEHÍCULOS Y FOTOS
  private vehicleMarker: L.Marker | null = null;
  private vehiculos = new Map<string, L.Marker>();
  private photoMarkers: L.Marker[] = [];

  // RUTAS / RECORRIDOS
  private waypoints: L.LatLng[] = [];
  private pointLayers: L.Layer[] = [];
  private routeLayer: L.GeoJSON | null = null;
  private currentRouteLayer: L.GeoJSON | null = null;
  private rutasActivas = new Map<string, L.GeoJSON>();

  // INICIO / FIN MARKERS
  private inicioMarkers = new Map<string, L.Layer>();
  private finMarkers = new Map<string, L.Layer>();
  private startCoords = new Map<string, [number, number]>();
  private routeCoords = new Map<string, [number, number][]>();
  private trails = new Map<string, L.Polyline>();
  private rutaHaciaInicio = new Map<string, L.Polyline>();
  private ultimaActualizacionRutaHaciaInicio = new Map<string, number>();

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

  private readonly MAPBOX_TOKEN = 'pk.eyJ1Ijoiam9hbjk5IiwiYSI6ImNtcG9ocDJoejAzcTgycG9paTIwM255YXcifQ.mOFdSwp7QG5Z4MWuQOJ6hg';

  constructor(private http: HttpClient) { }

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

      this.liveGroup.addTo(this.map);

      this.map.on('click', () => this.clearPhotoMarkers());
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

  canCreateRoute() {
    return this.waypoints.length >= 2;
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
      this.drawGroup.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
    this.removeDraftEndpoints();
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
    }).addTo(this.drawGroup);

    this.pointLayers.push(point);
  };

  undoLastPoint() {
    if (!this.map) return;

    // Si la ruta ya estaba generada, simplemente deshacemos la línea generada
    // para que el usuario pueda seguir editando los puntos previos.
    if (this.routeCreated) {
      if (this.routeLayer) {
        this.drawGroup.removeLayer(this.routeLayer);
        this.routeLayer = null;
      }
      this.routeCreated = false;
      this.removeDraftEndpoints();
      return;
    }

    const last = this.pointLayers.pop();
    if (last) this.drawGroup.removeLayer(last);

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

      if (this.routeLayer) this.drawGroup.removeLayer(this.routeLayer);

      this.routeLayer = L.geoJSON(geometry, {
        style: { color: '#007BFF', weight: 4 }
      }).addTo(this.drawGroup);

      this.routeCreated = true;
      this.clearMarkers();

      const coords = geometry.coordinates as [number, number][];
      this.setRouteEndpoints('draft', coords);
    });
  }

  // =========================================================
  // LIMPIEZA
  // =========================================================
  private clearMarkers() {
    this.pointLayers.forEach(l => this.drawGroup.removeLayer(l));
    this.pointLayers = [];
  }

  private removeDraftEndpoints() {
    const inicio = this.inicioMarkers.get('draft');
    const fin = this.finMarkers.get('draft');
    if (inicio) {
      this.drawGroup.removeLayer(inicio);
      this.liveGroup.removeLayer(inicio);
      inicio.remove();
      this.inicioMarkers.delete('draft');
    }
    if (fin) {
      this.drawGroup.removeLayer(fin);
      this.liveGroup.removeLayer(fin);
      fin.remove();
      this.finMarkers.delete('draft');
    }
    this.startCoords.delete('draft');
    this.routeCoords.delete('draft');
  }

  private removeStaticEndpoints() {
    const inicio = this.inicioMarkers.get('static-route');
    const fin = this.finMarkers.get('static-route');
    if (inicio) {
      this.liveGroup.removeLayer(inicio);
      this.drawGroup.removeLayer(inicio);
      inicio.remove();
      this.inicioMarkers.delete('static-route');
    }
    if (fin) {
      this.liveGroup.removeLayer(fin);
      this.drawGroup.removeLayer(fin);
      fin.remove();
      this.finMarkers.delete('static-route');
    }
    this.startCoords.delete('static-route');
    this.routeCoords.delete('static-route');
  }

  private clearRouteEndpoints() {
    this.inicioMarkers.forEach(m => {
      this.liveGroup.removeLayer(m);
      this.drawGroup.removeLayer(m);
      m.remove();
    });
    this.finMarkers.forEach(m => {
      this.liveGroup.removeLayer(m);
      this.drawGroup.removeLayer(m);
      m.remove();
    });

    this.inicioMarkers.clear();
    this.finMarkers.clear();
    this.startCoords.clear();
    this.routeCoords.clear();
    this.trails.forEach(t => {
      this.liveGroup.removeLayer(t);
      this.drawGroup.removeLayer(t);
      t.remove();
    });
    this.trails.clear();

    this.rutaHaciaInicio.forEach(r => {
      this.liveGroup.removeLayer(r);
      this.drawGroup.removeLayer(r);
      r.remove();
    });
    this.rutaHaciaInicio.clear();
  }

  private resetAll() {
    if (!this.map) return;

    this.routeLayer && this.drawGroup.removeLayer(this.routeLayer);
    this.currentRouteLayer && this.liveGroup.removeLayer(this.currentRouteLayer);

    this.clearMarkers();
    this.removeDraftEndpoints();
    this.removeStaticEndpoints();
    this.waypoints = [];
    this.routeCreated = false;
  }

  resetMap() {
    this.resetAll();
  }

  private driverMarker: L.Marker | null = null;

  // =========================================================
  // RUTA ESTÁTICA
  // =========================================================
  showRoute(coordinates: [number, number][], id: string = 'static-route') {
    if (!this.map || coordinates.length < 2) return;

    this.clearLiveRoutes();

    if (this.currentRouteLayer) {
      this.liveGroup.removeLayer(this.currentRouteLayer);
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
    }).addTo(this.liveGroup);

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
    if (existente) this.liveGroup.removeLayer(existente);

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates }
    };

    const layer = L.geoJSON(geojson, {
      style: { color, weight: 4, opacity: 0.8 }
    }).addTo(this.liveGroup);

    this.rutasActivas.set(recorridoId, layer);
  }

  removerRutaViva(recorridoId: string) {
    const layer = this.rutasActivas.get(recorridoId);
    if (layer) {
      this.liveGroup.removeLayer(layer);
      this.rutasActivas.delete(recorridoId);
    }

    const inicio = this.inicioMarkers.get(recorridoId);
    const fin = this.finMarkers.get(recorridoId);
    if (inicio) { this.liveGroup.removeLayer(inicio); this.inicioMarkers.delete(recorridoId); }
    if (fin) { this.liveGroup.removeLayer(fin); this.finMarkers.delete(recorridoId); }
    this.startCoords.delete(recorridoId);
    this.routeCoords.delete(recorridoId);
    this.removerTrail(recorridoId);
    
    const rutaInicio = this.rutaHaciaInicio.get(recorridoId);
    if (rutaInicio) {
      this.liveGroup.removeLayer(rutaInicio);
      this.rutaHaciaInicio.delete(recorridoId);
    }
  }

  clearLiveRoutes() {
    if (!this.map) return;

    this.rutasActivas.forEach(l => this.liveGroup.removeLayer(l));
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

      this.trazarCamionHastaInicio(recorridoId, lat, lng);
      return;
    }

    const marker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'truck.png',
        iconSize: [35, 35],
        iconAnchor: [17, 17]
      })
    }).addTo(this.liveGroup);

    marker.bindTooltip(tooltip, {
      direction: 'top',
      offset: [0, -18],
      sticky: true,
      opacity: 0.95
    });

    marker.on('click', () => {
      this.cargarFotosRecorrido(recorridoId);
    });

    this.vehiculos.set(recorridoId, marker);
    this.trazarCamionHastaInicio(recorridoId, lat, lng);
  }

  private crearTooltipVehiculo(info?: { ruta?: string; conductor?: string; placa?: string }) {
    const ruta = info?.ruta || 'Ruta no identificada';
    const conductor = info?.conductor || 'Conductor no identificado';
    const placa = info?.placa || 'Placa no identificada';

    return `
      <div style="font-size:12px;line-height:1.35;">
        <strong>Ruta:</strong> ${ruta}<br>
        <strong>Conductor:</strong> ${conductor}<br>
        <strong>Vehículo:</strong> ${placa}<br>
        <em style="color:#3b82f6;font-size:10px;">🖱️ Click para ver fotos</em>
      </div>
    `;
  }

  removerVehiculo(recorridoId: string) {
    const marker = this.vehiculos.get(recorridoId);

    if (!marker) return;

    this.liveGroup.removeLayer(marker);
    this.vehiculos.delete(recorridoId);
    this.removerTrail(recorridoId);

    const rutaInicio = this.rutaHaciaInicio.get(recorridoId);
    if (rutaInicio) {
      this.liveGroup.removeLayer(rutaInicio);
      this.rutaHaciaInicio.delete(recorridoId);
    }
  }

  private actualizarTrail(recorridoId: string, lat: number, lng: number) {
    if (!this.map) return;
    const route = this.routeCoords.get(recorridoId);
    if (!route || route.length < 2) return;

    const oldTrail = this.trails.get(recorridoId);
    if (oldTrail) this.liveGroup.removeLayer(oldTrail);

    // Encontrar el punto más cercano de la ruta al vehículo
    let minDist = Infinity;
    let closestIdx = 0;
    for (let i = 0; i < route.length; i++) {
      const [clng, clat] = route[i];
      const dist = (clat - lat) ** 2 + (clng - lng) ** 2;
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }

    // Trazo desde inicio hasta el punto más cercano (siguiendo la ruta)
    const traveled = route.slice(0, closestIdx + 1).map(c => [c[1], c[0]] as [number, number]);
    traveled.push([lat, lng]); // añadir posición actual del vehículo

    const trail = L.polyline(traveled, {
      color: '#94a3b8',
      weight: 2,
      opacity: 0.5,
      dashArray: '8 6',
    }).addTo(this.liveGroup);

    this.trails.set(recorridoId, trail);
  }

  private removerTrail(recorridoId: string) {
    const trail = this.trails.get(recorridoId);
    if (trail) {
      this.liveGroup.removeLayer(trail);
      this.trails.delete(recorridoId);
    }
  }


  private trazarCamionHastaInicio(recorridoId: string, lat: number, lng: number): void {
    if (!this.map) return;

    const inicio = this.startCoords.get(recorridoId);
    if (!inicio) return;

    const [latInicio, lngInicio] = inicio;

    // Si ya está cerca del inicio (< 80m), quitar el trazo
    const distancia = this.map.distance([lat, lng], [latInicio, lngInicio]);
    if (distancia < 80) {
      const old = this.rutaHaciaInicio.get(recorridoId);
      if (old) { this.liveGroup.removeLayer(old); this.rutaHaciaInicio.delete(recorridoId); }
      return;
    }

    // Throttle: solo actualizar cada 15 segundos
    const ahora = Date.now();
    const ultima = this.ultimaActualizacionRutaHaciaInicio.get(recorridoId) || 0;
    if (this.rutaHaciaInicio.has(recorridoId) && (ahora - ultima < 15000)) return;
    this.ultimaActualizacionRutaHaciaInicio.set(recorridoId, ahora);

    const url = `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${lngInicio},${latInicio}?overview=full&geometries=geojson`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.code !== 'Ok' || !data.routes?.length) {
          console.error('OSRM no devolvió ruta válida', data);
          return;
        }

        const coords: number[][] = data.routes[0].geometry.coordinates;
        const leafletCoords = coords.map((c: number[]) => [c[1], c[0]] as [number, number]);

        const existente = this.rutaHaciaInicio.get(recorridoId);
        if (existente) {
          existente.setLatLngs(leafletCoords);
        } else {
          const polyline = L.polyline(leafletCoords, {
            color: '#6366f1',
            weight: 3,
            dashArray: '10, 10',
            opacity: 0.7,
            lineJoin: 'round'
          }).addTo(this.liveGroup);
          polyline.bindPopup('Camino hacia el inicio de la ruta');
          this.rutaHaciaInicio.set(recorridoId, polyline);
        }
      })
      .catch(err => {
        console.error('Error obteniendo ruta OSRM:', err);
        // Fallback: línea recta
        const existente = this.rutaHaciaInicio.get(recorridoId);
        if (existente) {
          existente.setLatLngs([[lat, lng], [latInicio, lngInicio]]);
        } else {
          const polyline = L.polyline([[lat, lng], [latInicio, lngInicio]], {
            color: '#6366f1',
            weight: 5,
            dashArray: '10, 10',
            opacity: 0.8
          }).addTo(this.liveGroup);
          this.rutaHaciaInicio.set(recorridoId, polyline);
        }
      });
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

    if (oldStart) {
      this.liveGroup.removeLayer(oldStart);
      this.drawGroup.removeLayer(oldStart);
      oldStart.remove();
    }
    if (oldEnd) {
      this.liveGroup.removeLayer(oldEnd);
      this.drawGroup.removeLayer(oldEnd);
      oldEnd.remove();
    }

    const targetGroup = recorridoId === 'draft' ? this.drawGroup : this.liveGroup;

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
    }).addTo(targetGroup);

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
    }).addTo(targetGroup);

    this.inicioMarkers.set(recorridoId, startMarker);
    this.finMarkers.set(recorridoId, endMarker);
    this.startCoords.set(recorridoId, [start[1], start[0]]);
    this.routeCoords.set(recorridoId, coordinates);
  }

  syncMapa(recorridos: any[], rutaSeleccionada?: any) {
    this.clearLiveRoutes();

    recorridos.forEach((recorrido) => {
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

        if (coords.length > 1) {
          this.showLiveRoute(recorrido.id, coords, this.getColorByEstado(recorrido.estado));
          this.setRouteEndpoints(recorrido.id, coords);
        }
      } catch (e) {
        console.error('Error parseando shape en syncMapa', e);
      }
    });

    if (rutaSeleccionada?.shape) {
      try {
        const shape = JSON.parse(rutaSeleccionada.shape);
        const coords = shape.type === 'LineString' ? shape.coordinates : shape.coordinates.flat();
        this.showRoute(coords, rutaSeleccionada.id);
      } catch (e) { }
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
        return '#98c1f3ff';

      default:
        return '#9E9E9E';
    }
  }
  /** Actualizar posición en tiempo real del conductor */
  updateDriverPosition(lat: number, lng: number) {
    if (!this.map) return;

    if (!this.driverMarker) {
      // Crea un icono personalizado (camión o punto)
      const truckIcon = L.divIcon({
        className: 'driver-marker',
        html: `<div style="width: 20px; height: 20px; background-color: #00E5FF; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,229,255,0.8);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      this.driverMarker = L.marker([lat, lng], { icon: truckIcon }).addTo(this.liveGroup);
    } else {
      this.driverMarker.setLatLng([lat, lng]);
    }

    // Opcional: centrar el mapa en el conductor
    // this.map.setView([lat, lng]);
  }

  /** Remover marcador del conductor */
  clearDriverMarker() {
    if (this.driverMarker && this.map) {
      this.liveGroup.removeLayer(this.driverMarker);
      this.driverMarker = null;
    }
  }

  // FOTOS EN EL MAPA
  private readonly apiUrl = environment.apiUrl;

  clearPhotoMarkers() {
    if (!this.map) return;
    this.photoMarkers.forEach(m => this.liveGroup.removeLayer(m));
    this.photoMarkers = [];
  }

  cargarFotosRecorrido(recorridoId: string) {
    this.clearPhotoMarkers();

    this.http.get<any[]>(`${this.apiUrl}/operativo/recorridos/${recorridoId}/posiciones/fotos`)
      .subscribe({
        next: (fotos) => {
          if (!fotos || fotos.length === 0) {
            console.log('📷 No hay fotos para este recorrido');
            return;
          }

          fotos.forEach((foto: any) => {
            this.showPhotoMarker(
              foto.lat,
              foto.lon,
              foto.capturado_ts,
              foto.imagen_base64,
            );
          });

          // Ajustar vista para mostrar todas las fotos
          if (this.photoMarkers.length > 0 && this.map) {
            const group = L.featureGroup(this.photoMarkers);
            this.map.fitBounds(group.getBounds().pad(0.1));
          }
        },
        error: (err) => {
          console.error('❌ Error cargando fotos:', err);
        }
      });
  }

  showPhotoMarker(lat: number, lon: number, timestamp: number, imagenBase64: string) {
    if (!this.map) return;

    const fecha = new Date(timestamp);
    const dateStr = fecha.toLocaleString('es-ES', {
      day: 'numeric', month: 'numeric', year: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric'
    });

    const cameraIcon = L.divIcon({
      html: `
        <div style="
          position: relative;
          width: 36px;
          height: 36px;
        ">
          <div style="
            width: 36px; 
            height: 36px; 
            background: #3b82f6; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            border: 2px solid white;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            z-index: 2;
            position: relative;
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
              <circle cx="12" cy="13" r="3"></circle>
            </svg>
          </div>
          <!-- Triangle tail -->
          <div style="
            position: absolute;
            bottom: -6px;
            left: 50%;
            transform: translateX(-50%);
            width: 0; 
            height: 0; 
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 8px solid #3b82f6;
            z-index: 1;
          "></div>
        </div>
      `,
      className: '',
      iconSize: [36, 42],
      iconAnchor: [18, 42],
      popupAnchor: [0, -42]
    });

    const marker = L.marker([lat, lon], { icon: cameraIcon }).addTo(this.liveGroup);

    const src = imagenBase64 && imagenBase64.startsWith('data:image')
      ? imagenBase64
      : (imagenBase64 ? 'data:image/jpeg;base64,' + imagenBase64 : '');

    const popupContent = `
      <div style="position: relative; width: 220px; height: 300px; border-radius: 12px; overflow: hidden; background: #111; box-shadow: 0 8px 16px rgba(0,0,0,0.4);">
            <img src="${src}" style="width: 100%; height: 100%; object-fit: contain; display: block;" />
            <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 20px 12px 12px; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%); color: white; font-family: sans-serif; font-size: 13px; font-weight: 500; text-align: center; pointer-events: none;">
              ${dateStr}
            </div>
          </div>
        `;
    marker.bindPopup(popupContent, { maxWidth: 220, minWidth: 220, className: 'premium-photo-popup', closeButton: true });

    this.photoMarkers.push(marker);
  }

  // =========================================================
  // CONTROL DE CAPAS (LIVE VS DRAW)
  // =========================================================
  getMode() {
    return this.currentMode;
  }

  setMode(mode: 'live' | 'draw') {
    if (!this.map) return;
    this.currentMode = mode;

    if (mode === 'draw') {
      if (this.map.hasLayer(this.liveGroup)) {
        this.map.removeLayer(this.liveGroup);
      }
      if (!this.map.hasLayer(this.drawGroup)) {
        this.drawGroup.addTo(this.map);
      }
    } else {
      if (this.map.hasLayer(this.drawGroup)) {
        this.map.removeLayer(this.drawGroup);
      }
      if (!this.map.hasLayer(this.liveGroup)) {
        this.liveGroup.addTo(this.map);
      }
    }
  }
}
