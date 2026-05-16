import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { HttpClient } from '@angular/common/http';
import * as GeoJSON from 'geojson';

@Injectable({
  providedIn: 'root',
})
export class LeafletMapService {

  private map: L.Map | null = null;
  private routeCreated = false;

  private waypoints: L.LatLng[] = [];
  private pointLayers: L.Layer[] = [];
  private routeLayer: L.GeoJSON | null = null;
  private currentRouteLayer: L.GeoJSON | null = null;

  private MAPBOX_TOKEN = 'pk.eyJ1Ijoiam9hbjk5IiwiYSI6ImNtaXBwc2FwcDA4cXYzZ3B2djMzdWsxZDQifQ.jpYs7Myh7Pybt29kWrupog';

  constructor(private http: HttpClient) {}

  /** Redimensiona el mapa cuando el contenedor cambia de tamaño */
  resizeMap() {
    if (this.map) {
      setTimeout(() => {
        this.map!.invalidateSize();
      }, 100);
    }
  }

  /** Inicializa el mapa */
  initMap(containerId: string) {
  // Si el contenedor cambió (Angular destruyó el HTML), recrea el mapa
  const container = document.getElementById(containerId);

  if (!container) return;

  // Si el mapa existe pero el DIV fue recreado → reinicializar
  if (this.map && this.map.getContainer() !== container) {
    this.map.remove();   // elimina completamente el mapa anterior
    this.map = null;
  }

  if (!this.map) {
    this.map = L.map(containerId).setView([3.8801, -77.0312], 14);

    L.tileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${this.MAPBOX_TOKEN}`,
      { tileSize: 512, zoomOffset: -1 }
    ).addTo(this.map);
  }

  // Recalcular tamaño siempre
  setTimeout(() => this.map!.invalidateSize(), 200);
}


  isRouteCreated() {
    return this.routeCreated;
  }

  /** Activar selección de puntos para trazar ruta manual */
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

  /** Desactivar selección de puntos */
  disablePointSelection() {
    if (!this.map) return;

    this.map.dragging.enable();
    this.map.getContainer().style.cursor = 'grab';
    this.map.off('click', this.selectPoint);
  }

  /** Evento click para seleccionar un punto */
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

  /** Retroceder último punto agregado */
  undoLastPoint() {
    if (!this.map) return;

    if (this.routeCreated) {
      this.resetAll();
      alert('Has revertido la ruta generada');
      return;
    }

    if (this.pointLayers.length === 0) return;

    const last = this.pointLayers.pop();
    if (last) this.map.removeLayer(last);

    this.waypoints.pop();
  }

  /** Crear ruta usando Mapbox Directions API */
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

  /** Limpiar marcadores de puntos */
  private clearMarkers() {
    if (!this.map) return;

    this.pointLayers.forEach(layer => this.map!.removeLayer(layer));
    this.pointLayers = [];
  }

  /** Reset completo del mapa */
  private resetAll() {
    if (!this.map) return;

    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }

    if (this.currentRouteLayer) {
      this.map.removeLayer(this.currentRouteLayer);
      this.currentRouteLayer = null;
    }

    this.clearMarkers();
    this.waypoints = [];
    this.routeCreated = false;
  }

  /** Devuelve GeoJSON listo para guardar */
  getRouteGeoJSON(): { type: "LineString", coordinates: number[][] } | null {
  if (!this.routeLayer) return null;

  const geojson: any = this.routeLayer.toGeoJSON();

  // Caso 1: es un Feature con LineString
  if (geojson.type === "Feature" && geojson.geometry?.type === "LineString") {
    return {
      type: "LineString",
      coordinates: geojson.geometry.coordinates
    };
  }

  // Caso 2: FeatureCollection con un Feature LineString
  if (geojson.type === "FeatureCollection" && geojson.features?.length > 0) {
    const feature = geojson.features[0];
    if (feature.geometry?.type === "LineString") {
      return {
        type: "LineString",
        coordinates: feature.geometry.coordinates
      };
    }
  }

    return null;
  }

  /** Reset manual de mapa */
  resetMap() {
    this.resetAll();
  }

  private driverMarker: L.Marker | null = null;

  //** Mostrar ruta guardada en coordenadas [lng, lat] */
  showRoute(coordinates: [number, number][]) {
    if (!this.map || coordinates.length < 2) return;

    // Elimina la capa anterior si existe
    if (this.currentRouteLayer) {
      this.map.removeLayer(this.currentRouteLayer);
      this.currentRouteLayer = null;
    }

    // Crea un Feature GeoJSON de tipo LineString
    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates }
    };

    // Añade la ruta al mapa
    this.currentRouteLayer = L.geoJSON(geojson, {
      style: { color: '#007BFF', weight: 4 }
    }).addTo(this.map);

    // Ajusta los bounds del mapa
    // Leaflet fitBounds acepta un array de tuplas [lat, lng]
    const latLngs: [number, number][] = coordinates.map(c => [c[1], c[0]]);
    this.map.fitBounds(latLngs);
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

      this.driverMarker = L.marker([lat, lng], { icon: truckIcon }).addTo(this.map);
    } else {
      this.driverMarker.setLatLng([lat, lng]);
    }
    
    // Opcional: centrar el mapa en el conductor
    // this.map.setView([lat, lng]);
  }

  /** Remover marcador del conductor */
  clearDriverMarker() {
    if (this.driverMarker && this.map) {
      this.map.removeLayer(this.driverMarker);
      this.driverMarker = null;
    }
  }
}






