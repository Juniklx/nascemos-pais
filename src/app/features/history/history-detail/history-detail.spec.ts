import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { DiaperService } from '../../../core/services/diaper';
import { FeedingService } from '../../../core/services/feeding';
import { SleepService } from '../../../core/services/sleep';
import { HistoryDetail } from './history-detail';

describe('HistoryDetail: confirmação de exclusão pelo teclado', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ type: 'diaper', id: 'test' }) } },
        },
        { provide: FeedingService, useValue: { feedings: signal([]), isSaving: signal(false) } },
        { provide: SleepService, useValue: { sleeps: signal([]), isSaving: signal(false) } },
        {
          provide: DiaperService,
          useValue: {
            diapers: signal([{ id: 'test', type: 'wet', recordedAt: Date.now() }]),
            isSaving: signal(false),
            label: () => 'Molhada',
          },
        },
      ],
    }).compileComponents();
  });

  it('move e mantém o foco no diálogo, fecha com Escape e devolve o foco', async () => {
    const fixture = TestBed.createComponent(HistoryDetail);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector('.delete-button') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    await fixture.whenRenderingDone();

    const cancel = root.querySelector('.cancel-button') as HTMLButtonElement;
    const confirm = root.querySelector('.confirm-delete-button') as HTMLButtonElement;
    expect(document.activeElement).toBe(cancel);

    cancel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(confirm);
    confirm.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(cancel);

    cancel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await fixture.whenRenderingDone();
    expect(root.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fixture.destroy();
  });
});
