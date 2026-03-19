import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.services';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './authcallback.html',
  styleUrls: ['./authcallback.scss']
})
export class AuthCallback implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  ngOnInit() {

    this.route.queryParams.subscribe(params => {

      const token = params['token'];

      console.log("TOKEN:", token);

      if (token) {

        localStorage.setItem('token', token);

        this.auth.getProfile().subscribe({

          next: (user) => {

            console.log('Usuario cargado:', user);

            this.router.navigate(['/principal']);

          },

          error: (err) => {

            console.log("Error profile:", err);

            this.router.navigate(['/login']);

          }

        });

      } else {

        console.log("No vino token");

        this.router.navigate(['/login']);

      }

    });

  }

}



