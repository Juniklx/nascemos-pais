import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms-of-use',
  imports: [RouterLink],
  templateUrl: './terms-of-use.html',
  styleUrl: '../privacy/privacy-policy.css',
})
export class TermsOfUsePage {
  readonly updatedAt = '24 de setembro de 2026';
  readonly contact = 'privacidade@nascemospais.com.br';
}
