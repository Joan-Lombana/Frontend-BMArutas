import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class VehiculosService {
  private baseUrl = `${environment.apiUrl}/operativo`;

  constructor(private http: HttpClient) {}

  // -------------------------------
  // 📌 Crear vehículo
  // -------------------------------
  registrarVehiculo(vehiculo: any) {
    console.log("📤 POST ->", `${this.baseUrl}/vehiculos/crear`, vehiculo);
    return this.http.post(`${this.baseUrl}/vehiculos/crear`, vehiculo);
  }

  // -------------------------------
  // 📌 Listar vehículos
  // -------------------------------
  getVehiculos() {
    console.log("📥 GET ->", `${this.baseUrl}/vehiculos`);
    return this.http.get(`${this.baseUrl}/vehiculos`);
  }

  // -------------------------------
  // 📌 Actualizar vehículo
  // -------------------------------
  actualizarVehiculo(vehiculoId: string, datos: any) {
    console.log("✏️ PUT ->", `${this.baseUrl}/vehiculos/${vehiculoId}`, datos);
    return this.http.put(`${this.baseUrl}/vehiculos/${vehiculoId}`, datos);
  }

  // -------------------------------
  // 📌 Eliminar vehículo
  // -------------------------------
  eliminarVehiculo(vehiculoId: string) {
    console.log("🗑️ DELETE ->", `${this.baseUrl}/vehiculos/${vehiculoId}`);
    return this.http.delete(`${this.baseUrl}/vehiculos/${vehiculoId}`);
  }
}