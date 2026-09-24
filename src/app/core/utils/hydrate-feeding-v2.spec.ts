import { hydrateFeedingV2 } from './hydrate-feeding-v2';

describe('hydrateFeedingV2', () => {
  const parent = {
    id: 'feeding-a',
    storageVersion: 2,
    startedAt: 1000,
    endedAt: 1300,
    side: 'right',
    periodCount: 3,
    lastPeriodId: '00000002',
    lastPeriodStartedAt: 1200,
    createdByUid: 'user-a',
    finishedByUid: 'user-b',
  };

  const periods = [
    { id: '00000000', index: 0, startedAt: 1000, endedAt: 1100, side: 'left' },
    { id: '00000001', index: 1, startedAt: 1100, endedAt: 1200, side: null },
    { id: '00000002', index: 2, startedAt: 1200, endedAt: 1300, side: 'right' },
  ];

  it('hidrata registros completos fora de ordem sem expor os índices à interface', () => {
    const result = hydrateFeedingV2(parent, [periods[2], periods[0], periods[1]]);

    expect(result.periods).toEqual([
      { startedAt: 1000, endedAt: 1100, side: 'left' },
      { startedAt: 1100, endedAt: 1200, side: null },
      { startedAt: 1200, endedAt: 1300, side: 'right' },
    ]);
    expect(result.createdByUid).toBe('user-a');
    expect(result.finishedByUid).toBe('user-b');
  });

  it('hidrata mamadas abertas com o último período ainda em andamento', () => {
    const result = hydrateFeedingV2(
      { ...parent, endedAt: null, finishedByUid: undefined },
      [...periods.slice(0, 2), { ...periods[2], endedAt: null }],
    );

    expect(result.endedAt).toBeNull();
    expect(result.periods?.[2].endedAt).toBeNull();
  });

  it('permite ler mais de seis períodos sem descartar horários', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      id: String(index).padStart(8, '0'),
      index,
      startedAt: 1000 + index * 100,
      endedAt: 1100 + index * 100,
      side: index % 2 === 0 ? 'left' : 'right',
    }));
    const result = hydrateFeedingV2(
      { ...parent, periodCount: 20, lastPeriodId: '00000019', lastPeriodStartedAt: 2900, endedAt: 3000, side: 'right' },
      many,
    );

    expect(result.periods?.length).toBe(20);
    expect(result.periods?.[19].startedAt).toBe(2900);
  });

  it('recusa quando faltam períodos', () => {
    expect(() => hydrateFeedingV2(parent, periods.slice(0, 2))).toThrowError(
      'A lista de períodos está incompleta ou possui elementos extras.',
    );
  });

  it('recusa índices duplicados ou ausentes mesmo com a contagem correta', () => {
    const repeated = [{ ...periods[0] }, { ...periods[0] }, periods[2]];
    const missingIndex = [periods[0], { ...periods[1], id: '00000003', index: 3 }, periods[2]];

    expect(() => hydrateFeedingV2(parent, repeated)).toThrowError(
      'Os índices dos períodos estão incompletos ou duplicados.',
    );
    expect(() => hydrateFeedingV2(parent, missingIndex)).toThrowError(
      'Os índices dos períodos estão incompletos ou duplicados.',
    );
  });

  it('recusa lacunas e sobreposições temporais', () => {
    const gap = [periods[0], { ...periods[1], startedAt: 1101 }, periods[2]];
    const overlap = [periods[0], { ...periods[1], startedAt: 1099 }, periods[2]];

    expect(() => hydrateFeedingV2(parent, gap)).toThrowError(
      'Os períodos da mamada possuem lacunas ou sobreposições.',
    );
    expect(() => hydrateFeedingV2(parent, overlap)).toThrowError(
      'Os períodos da mamada possuem lacunas ou sobreposições.',
    );
  });

  it('recusa períodos intermediários abertos', () => {
    const invalid = [periods[0], { ...periods[1], endedAt: null }, periods[2]];

    expect(() => hydrateFeedingV2(parent, invalid)).toThrowError(
      'Foi encontrado um período aberto antes do último.',
    );
  });

  it('recusa último identificador divergente da contagem', () => {
    expect(() => hydrateFeedingV2({ ...parent, lastPeriodId: '00000001' }, periods)).toThrowError(
      'Resumo da mamada v2 inválido.',
    );
  });

  it('recusa alterações divergentes entre o resumo e o último período', () => {
    expect(() => hydrateFeedingV2({ ...parent, side: 'left' }, periods)).toThrowError(
      'O resumo da mamada não corresponde ao último período.',
    );
    expect(() => hydrateFeedingV2({ ...parent, lastPeriodStartedAt: 1201 }, periods)).toThrowError(
      'O resumo da mamada não corresponde ao último período.',
    );
  });

  it('recusa payload com campos extras, IDs errados e datas inválidas', () => {
    const badId = [{ ...periods[0], id: 'wrong' }, ...periods.slice(1)];
    const badField = [{ ...periods[0], secret: 'injected' }, ...periods.slice(1)];
    const badTimestamp = [{ ...periods[0], endedAt: -2 }, ...periods.slice(1)];

    expect(() => hydrateFeedingV2(parent, badId)).toThrowError('Dados do período v2 inválidos.');
    expect(() => hydrateFeedingV2(parent, badField)).toThrowError(
      'O período contém campos não permitidos.',
    );
    expect(() => hydrateFeedingV2(parent, badTimestamp)).toThrowError(
      'Dados do período v2 inválidos.',
    );
  });

  it('não confunde registros legados com o formato de subcoleção', () => {
    expect(() => hydrateFeedingV2(
      { ...parent, storageVersion: undefined, periods: null },
      periods,
    )).toThrowError('Formato v2 da mamada inválido.');
    expect(() => hydrateFeedingV2(
      { ...parent, periods: periods.slice(0, 2) },
      periods,
    )).toThrowError('Formato v2 da mamada inválido.');
  });
});
