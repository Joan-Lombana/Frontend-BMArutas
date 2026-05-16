import { Component, signal, OnInit, OnDestroy } from '@angular/core';

import { LoginComponent } from '../../components/login/login';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [LoginComponent],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss'
})
export class InicioComponent implements OnInit, OnDestroy {
  // Estado del navbar
  isScrolled = signal(false);
  mobileMenuOpen = signal(false);

  ngOnInit() {
    window.addEventListener('scroll', this.handleScroll);
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.handleScroll);
  }

  private handleScroll = () => {
    this.isScrolled.set(window.scrollY > 50);
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update(value => !value);
  }

  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.mobileMenuOpen.set(false);
    }
  }
}