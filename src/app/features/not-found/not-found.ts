import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './not-found.html',
  styleUrl: './not-found.css',
})
export class NotFoundPage implements OnInit, OnDestroy {
  private readonly meta = inject(Meta);
  private previousRobotsContent: string | null = null;

  ngOnInit(): void {
    this.previousRobotsContent = this.meta.getTag('name="robots"')?.content ?? null;
    this.meta.updateTag({ name: 'robots', content: 'noindex, follow' });
  }

  ngOnDestroy(): void {
    if (this.previousRobotsContent === null) {
      this.meta.removeTag('name="robots"');
      return;
    }

    this.meta.updateTag({ name: 'robots', content: this.previousRobotsContent });
  }
}
