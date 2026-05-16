import { Routes } from '@angular/router';
import { PrincipalComponent } from './pages/principal/principal';
import { RutasComponent } from './pages/rutas/rutas';
import { VehiculosComponent } from './pages/vehiculos/vehiculos';
import { AuthCallback } from './components/authcallback/authcallback';
import { NoBackLoginGuard } from './guards/no-back-login-guard';
import { AuthGuard } from './guards/auth.guard';
import { ConductoresComponent } from './pages/conductores/conductores';
import { RutasConcretadasComponent } from './pages/rutasconcretadas/rutasconcretadas';
import { IncidenciasComponent } from './pages/incidencias/incidencias';

export const routes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import('./pages/inicio/inicio').then(m => m.InicioComponent),
    canActivate: [NoBackLoginGuard]
  },

  { path: "principal",   component: PrincipalComponent,   canActivate: [AuthGuard] },
  { path: "rutas",       component: RutasComponent,       canActivate: [AuthGuard] },
  { path: "vehiculos",   component: VehiculosComponent,   canActivate: [AuthGuard] },
  { path: "conductores", component: ConductoresComponent, canActivate: [AuthGuard] },
  {path: "rutas-concretadas", component: RutasConcretadasComponent, canActivate: [AuthGuard]},
  { path: "incidencias",       component: IncidenciasComponent,       canActivate: [AuthGuard] },

  { path: "auth-callback", component: AuthCallback },

  { path: "**", redirectTo: "" }
];

