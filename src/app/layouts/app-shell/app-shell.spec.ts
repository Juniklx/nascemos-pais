import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { Baby, LinkedBaby } from '../../core/models/baby';
import { ActivityPersistenceService } from '../../core/services/activity-persistence';
import { BabyContextService } from '../../core/services/baby-context';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  let shell: AppShell;

  const activeBabyId = signal<string | null>('baby-1');
  const baby = signal<Baby | null>({
    id: 'baby-1',
    name: 'Helena',
    birthDate: '2026-01-01',
    createdByUid: 'user-a',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const linkedBabies = signal<readonly LinkedBaby[]>([
    {
      baby: baby()!,
      membership: {
        uid: 'user-a',
        role: 'owner',
        joinedAt: '2026-01-01T00:00:00.000Z',
      },
    },
    {
      baby: {
        id: 'baby-2',
        name: 'Lucas',
        birthDate: '2026-02-01',
        createdByUid: 'user-a',
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
      },
      membership: {
        uid: 'user-a',
        role: 'owner',
        joinedAt: '2026-02-01T00:00:00.000Z',
      },
    },
  ]);

  const selectBaby = jasmine.createSpy('selectBaby');
  const loadActivities = jasmine.createSpy('load');
  const navigate = jasmine.createSpy('navigate');

  beforeEach(() => {
    activeBabyId.set('baby-1');

    baby.set({
      id: 'baby-1',
      name: 'Helena',
      birthDate: '2026-01-01',
      createdByUid: 'user-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    selectBaby.calls.reset();
    loadActivities.calls.reset();
    navigate.calls.reset();

    selectBaby.and.callFake(async (babyId: string) => {
      activeBabyId.set(babyId);
    });
    loadActivities.and.resolveTo({
      feedings: [],
      sleeps: [],
      diapers: [],
    });
    navigate.and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: Router,
          useValue: {
            navigate,
          },
        },
        {
          provide: ActivityPersistenceService,
          useValue: {
            load: loadActivities,
          },
        },
        {
          provide: BabyContextService,
          useValue: {
            linkedBabies: linkedBabies.asReadonly(),
            activeBabyId: activeBabyId.asReadonly(),
            baby: baby.asReadonly(),
            selectBaby,
          },
        },
      ],
    });

    shell = TestBed.runInInjectionContext(() => new AppShell());
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('troca o bebê ativo, recarrega os registros e abre a home', async () => {
    await shell.switchBaby(changeEvent('baby-2'));

    expect(selectBaby).toHaveBeenCalledOnceWith('baby-2');
    expect(loadActivities).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledOnceWith(['/home']);
    expect(shell.switchError()).toBe('');
    expect(shell.switchingBabyId()).toBeNull();
  });

  it('ignora seleção do bebê que já está ativo', async () => {
    await shell.switchBaby(changeEvent('baby-1'));

    expect(selectBaby).not.toHaveBeenCalled();
    expect(loadActivities).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('mantém a tela atual e exibe erro quando a troca falha', async () => {
    selectBaby.and.rejectWith(new Error('Falha ao trocar bebê.'));

    await shell.switchBaby(changeEvent('baby-2'));

    expect(loadActivities).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(shell.switchError()).toBe('Não foi possível trocar de bebê. Tente novamente.');
    expect(shell.switchingBabyId()).toBeNull();
  });
});

function changeEvent(babyId: string): Event {
  const select = document.createElement('select');
  const option = document.createElement('option');

  option.value = babyId;
  select.append(option);
  select.value = babyId;

  return {
    target: select,
  } as unknown as Event;
}
