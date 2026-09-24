import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth';
import { PrivacyDataExportService } from '../../core/services/privacy-data-export';

@Component({
  selector: 'app-my-data',
  imports: [RouterLink],
  templateUrl: './my-data.html',
  styleUrl: './my-data.css',
})
export class MyDataPage {
  private readonly exporter = inject(PrivacyDataExportService);
  private readonly auth = inject(AuthService);

  readonly exporting = signal(false);
  readonly message = signal('');
  readonly error = signal('');

  async downloadData(): Promise<void> {
    if (this.exporting()) {
      return;
    }

    const uid = this.auth.user()?.uid;

    if (!uid) {
      this.error.set('É necessário entrar na conta para exportar seus dados.');
      return;
    }

    this.exporting.set(true);
    this.message.set('');
    this.error.set('');

    try {
      const data = await this.exporter.collect();

      if (this.auth.user()?.uid !== uid) {
        throw new Error('A conta mudou durante a exportação.');
      }

      const file = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nascemos-pais-dados-${new Date().toISOString().slice(0, 10)}.json`;
      link.style.display = 'none';
      document.body.appendChild(link);

      try {
        link.click();
        this.message.set('Arquivo preparado. Armazene-o em um local seguro.');
      } finally {
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch {
      this.error.set('Não foi possível gerar o arquivo completo. Verifique sua conexão e tente novamente.');
    } finally {
      this.exporting.set(false);
    }
  }
}
