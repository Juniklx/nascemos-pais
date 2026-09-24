import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy-policy',
  imports: [RouterLink],
  templateUrl: './privacy-policy.html',
  styleUrl: './privacy-policy.css',
})
export class PrivacyPolicyPage {
  readonly updatedAt = '24 de setembro de 2026';
  readonly privacyContact = 'privacidade@nascemospais.com.br';
  readonly controller = 'Marcelo Soares Teixeira Junior';
}
