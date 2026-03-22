import { Component, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';

interface MenuItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss']
})
export class SidebarComponent {
  isOpen = input<boolean>(true);
  closeSidebar = output<void>();
  toggleSidebar = output<void>();

  menuItems: MenuItem[] = [
    { label: 'Principal', route: '/principal', icon: 'dashboard' },
    { label: 'Rutas programadas', route: '/rutas', icon: 'route' },
    { label: 'Vehículos', route: '/vehiculos', icon: 'truck' },
    { label: 'Conductores', route: '/conductores', icon: 'users' },
    { label: 'Rutas Concretadas', route: '/rutas-concretadas', icon: 'check-circle' }
  ];

  onNavigate() {
    if (window.innerWidth < 1024) {
      this.closeSidebar.emit();
    }
  }
}