import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private baseUrl = `${environment.apiUrl}/usuario`;

  constructor(private http: HttpClient) {}

  // -------------------------------
  // 📌 Listar todos los usuarios
  // -------------------------------
  getUsuarios() {
    console.log("📥 GET ->", this.baseUrl);
    return this.http.get(this.baseUrl);
  }

  // -------------------------------
  // 📌 Crear nuevo usuario (Conductor)
  // -------------------------------
  registrarConductor(usuario: any) {
    const payload = {
      ...usuario,
      rol: 'conductor'
    };
    console.log("📤 POST ->", `${this.baseUrl}/crear`, payload);
    return this.http.post(`${this.baseUrl}/crear`, payload);
  }

  // -------------------------------
  // 📌 Actualizar usuario
  // -------------------------------
  actualizarUsuario(id: string, datos: any) {
    console.log("✏️ PATCH ->", `${this.baseUrl}/${id}`);
    return this.http.patch(`${this.baseUrl}/${id}`, datos);
  }

  // -------------------------------
  // 📌 Eliminar usuario
  // -------------------------------
  eliminarUsuario(id: string) {
    console.log("🗑️ DELETE ->", `${this.baseUrl}/${id}`);
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
