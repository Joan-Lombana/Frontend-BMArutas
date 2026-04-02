import { Routes } from '@angular/router';
import { PrincipalComponent } from './pages/principal/principal';
import { RutasComponent } from './pages/rutas/rutas';
import { VehiculosComponent } from './pages/vehiculos/vehiculos';
import { AuthCallback } from './components/authcallback/authcallback';
import { NoBackLoginGuard } from './guards/no-back-login-guard';
import { AdminGuard } from './guards/admin.guard';

export const routes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import('./pages/inicio/inicio').then(m => m.InicioComponent),
    canActivate: [NoBackLoginGuard]
  },

  { path: "principal", component: PrincipalComponent , canActivate: [AdminGuard]},
  { path: "rutas", component: RutasComponent },
  { path: "vehiculos", component: VehiculosComponent },

  { path: "auth-callback", component: AuthCallback },

  { path: "**", redirectTo: "" }
];

