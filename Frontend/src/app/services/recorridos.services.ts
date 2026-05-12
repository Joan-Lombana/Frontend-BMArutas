import { Injectable } from '@angular/core';
import { HttpClient} from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RecorridosService {
  private baseUrl = `${environment.apiUrl}/operativo`;

  constructor(private http: HttpClient) {}

  // -------------------------------
  // 📌 Programar Recorrido (Crear)
  // -------------------------------
  programarRecorrido(datos: any) {
    // El payload debe contener ruta_id, vehiculo_id, conductor_id, horario_inicio
    const payload = {
      ...datos,
      
    };
    console.log("📤 POST ->", `${this.baseUrl}/recorridos/crear`, payload);
    return this.http.post(`${this.baseUrl}/recorridos/crear`, payload);
  }

  // -------------------------------
  // 📌 Listar Recorridos
  // -------------------------------
  getRecorridos() {
    
    console.log("📥 GET ->", `${this.baseUrl}/recorridos/local`);
    return this.http.get(`${this.baseUrl}/recorridos/local` );
  }



  // -------------------------------
  // 📌 Eliminar Recorrido
  // -------------------------------
  eliminarRecorrido(id: string) {
    console.log("🗑️ DELETE ->", `${this.baseUrl}/recorridos/${id}`);
    return this.http.delete(`${this.baseUrl}/recorridos/${id}`);
  }
}
