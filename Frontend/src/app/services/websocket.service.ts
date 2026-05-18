import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

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


  // SALAS

  unirseRecorrido(recorridoId: string) {
    this.socket.emit('unirseRecorrido', recorridoId);
  }

  salirRecorrido(recorridoId: string) {
    this.socket.emit('salirRecorrido', recorridoId);
  }

 
  // EVENTOS

  onEstadoRecorrido(): Observable<any> {
  return new Observable(observer => {
    this.socket.on(
      'recorrido.estado',
      (data) => {
        observer.next(data);
      }
    );
    return () => {
      this.socket.off(
        'recorrido.estado'
      );
    };
  });
 }

  onRecorridoEliminado(): Observable<any> {
  return new Observable(observer => {

    this.socket.on('recorrido.eliminado', data => {
      observer.next(data);
    });

    return () => {
      this.socket.off('recorrido.eliminado');
    };
  });
}

  onPosicion(): Observable<any> {
  return new Observable(observer => {

    this.socket.on('posicion', (data) => {
      observer.next(data);
    });

    return () => {
      this.socket.off('posicion');
    };
  });
 }

  onPosicionActualizada(): Observable<any> {
  return new Observable(observer => {

    this.socket.on('posicion.actualizada', data => {
      observer.next(data);
    });

    return () => {
      this.socket.off('posicion.actualizada');
    };
  });
 }


  // LIMPIEZA

  off(evento: string) {
    this.socket.off(evento);
  }

  disconnect() {
    this.socket.disconnect();
  }
}