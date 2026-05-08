import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {

  private socket: Socket;

  constructor() {

    this.socket = io(environment.wsUrl, {
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('🟢 WebSocket conectado:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('🔴 WebSocket desconectado');
    });
  }

  // =========================
  // SALAS
  // =========================

  unirseRecorrido(recorridoId: string) {
    this.socket.emit('unirseRecorrido', recorridoId);
  }

  salirRecorrido(recorridoId: string) {
    this.socket.emit('salirRecorrido', recorridoId);
  }

  // =========================
  // EVENTOS
  // =========================

  onEstadoRecorrido(callback: (data: any) => void) {
    this.socket.on('recorrido.estado', callback);
  }

  onRecorridoEliminado(callback: (data: any) => void) {
    this.socket.on('recorrido.eliminado', callback);
  }

  onPosicion(callback: (data: any) => void) {
    this.socket.on('posicion', callback);
  }

  onPosicionActualizada(callback: (data: any) => void) {
    this.socket.on('posicion.actualizada', callback);
  }

  // =========================
  // LIMPIEZA
  // =========================

  off(evento: string) {
    this.socket.off(evento);
  }

  disconnect() {
    this.socket.disconnect();
  }

}