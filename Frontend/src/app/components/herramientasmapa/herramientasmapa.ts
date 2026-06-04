import { Component,EventEmitter, Output } from '@angular/core';
import { LeafletMapService } from '../../services/leaflet-map.services';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RutasService } from '../../services/rutas.services';




@Component({
  selector: 'app-herramientasmapa',
  imports: [FormsModule, CommonModule],
  templateUrl: './herramientasmapa.html',
  styleUrl: './herramientasmapa.scss',
})
export class Herramientasmapa {
  @Output() cerrarHerramientas = new EventEmitter<void>();
  @Output() rutaGuardada = new EventEmitter<void>();

  showSaveModal = false;
  nombreRuta = "";
  modoDibujo = false; // ← nuevo estado

  constructor(
  private mapService: LeafletMapService,
  private api: RutasService

    
  ) {}

  onToolClick(event: MouseEvent) {
  const el = event.currentTarget as HTMLElement;

  // Reset animación para permitir múltiples clics
  el.classList.remove("clicked");
  void el.offsetWidth; // reinicia animación
  el.classList.add("clicked");
}


  openSaveModal() {
  if (!this.routeReady()) return;  // ← evita abrir el modal
  this.showSaveModal = true;
  }


  closeSaveModal() {
    this.showSaveModal = false;
  }

  closeSaveModalWithConfirm() {
  let continuar = true;
  if (this.modoDibujo || this.routeReady()) {
    continuar = confirm(
      '¿Estás seguro de cancelar? Se perderá el trazado actual.'
    );

    if (!continuar) return;
  }

  this.mapService.disablePointSelection();
  this.mapService.resetMap();
  this.modoDibujo = false;
  this.nombreRuta = "";
  this.cerrarHerramientas.emit();
}



  // Retroceder último punto
  undoPoint() {
    this.mapService.undoLastPoint();
    // Si deshicieron una ruta ya generada, pero no están en modo dibujo, lo reactivamos
    if (!this.routeReady() && !this.modoDibujo) {
      this.toggleDrawing();
    }
  }


  // Activar modo de selección de puntos
  toggleDrawing() {
    if (this.modoDibujo) {
      this.mapService.disablePointSelection();
    } else {
      this.mapService.enablePointSelection();
    }
    this.modoDibujo = !this.modoDibujo; // alterna estado
  }


  // Crear ruta con OSRM
  makeRoute() {
    if (!this.canMakeRoute()) {
      alert("Debes marcar al menos 2 puntos en el mapa para trazar la ruta.");
      return;
    }
    this.mapService.disablePointSelection();
    this.modoDibujo = false;
    this.mapService.createRoute();
  }

  canMakeRoute() {
    return this.mapService.canCreateRoute();
  }

  routeReady() {
    return this.mapService.isRouteCreated();
  }

  // Exportar GeoJSON
  saveRoute() {
  if (!this.nombreRuta.trim()) {
    alert("Por favor, ingresa un nombre para identificar la ruta.");
    return;
  }

  const geometry = this.mapService.getRouteGeoJSON(); // ya devuelve { type, coordinates }
  if (!geometry) {
    alert("No hay una ruta generada para guardar.");
    return;
  }

  const body = {
    nombre_ruta: this.nombreRuta,
    perfil_id: "bcadd725-99a9-458f-bb7f-2eea173c0eb3",
    shape: {
      type: geometry.type,
      coordinates: geometry.coordinates
    }
  };

  this.api.guardarRuta(body).subscribe({
    next: resp => {
      console.log("Ruta guardada", resp);
      this.rutaGuardada.emit();
      this.closeSaveModal();
      this.mapService.resetMap();
      this.nombreRuta = "";
      this.modoDibujo = false;
      this.cerrarHerramientas.emit();
      alert('La ruta ha sido registrada con éxito.');

    },
    error: err => {
      console.error("Error guardando ruta", err);
      alert("Ocurrió un error al guardar la ruta. Inténtalo de nuevo.");
    }
  });
}

}
