import type { Feeding, FeedingPeriod, FeedingSide } from '../models/feeding';

interface FeedingV2Document {
  readonly id: string;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly side: FeedingSide | null;
  readonly periodCount: number;
  readonly lastPeriodId: string;
  readonly lastPeriodStartedAt: number;
  readonly createdByUid?: string;
  readonly finishedByUid?: string;
}

// Adaptador puro de leitura; não ativa escritas v2 nem modifica o Firestore.
export function hydrateFeedingV2(parent: unknown, rawPeriods: readonly unknown[]): Feeding {
  if (!isRecord(parent) || parent['storageVersion'] !== 2 || 'periods' in parent) {
    throw new Error('Formato v2 da mamada inválido.');
  }

  const feeding = parseParent(parent);

  if (rawPeriods.length !== feeding.periodCount) {
    throw new Error('A lista de períodos está incompleta ou possui elementos extras.');
  }

  const periods = rawPeriods.map(parsePeriod).sort((a, b) => a.index - b.index);
  let previousEnd = feeding.startedAt;

  for (const [position, entry] of periods.entries()) {
    if (entry.index !== position) {
      throw new Error('Os índices dos períodos estão incompletos ou duplicados.');
    }

    if (entry.period.startedAt !== previousEnd) {
      throw new Error('Os períodos da mamada possuem lacunas ou sobreposições.');
    }

    if (position !== periods.length - 1 && entry.period.endedAt === null) {
      throw new Error('Foi encontrado um período aberto antes do último.');
    }

    previousEnd = entry.period.endedAt ?? entry.period.startedAt;
  }

  const last = periods[periods.length - 1].period;

  if (
    last.startedAt !== feeding.lastPeriodStartedAt ||
    last.endedAt !== feeding.endedAt ||
    last.side !== feeding.side
  ) {
    throw new Error('O resumo da mamada não corresponde ao último período.');
  }

  const result: Feeding = {
    id: feeding.id,
    startedAt: feeding.startedAt,
    endedAt: feeding.endedAt,
    side: feeding.side,
    periods: periods.map((entry) => entry.period),
  };

  if (feeding.createdByUid !== undefined) {
    Object.assign(result, { createdByUid: feeding.createdByUid });
  }

  if (feeding.finishedByUid !== undefined) {
    Object.assign(result, { finishedByUid: feeding.finishedByUid });
  }

  return result;
}

function parseParent(raw: Record<string, unknown>): FeedingV2Document {
  const id = raw['id'];
  const startedAt = raw['startedAt'];
  const endedAt = raw['endedAt'];
  const side = raw['side'];
  const periodCount = raw['periodCount'];
  const lastPeriodId = raw['lastPeriodId'];
  const lastPeriodStartedAt = raw['lastPeriodStartedAt'];
  const createdByUid = raw['createdByUid'];
  const finishedByUid = raw['finishedByUid'];

  if (
    typeof id !== 'string' || !id.trim() || id.includes('/') ||
    !isTimestamp(startedAt) ||
    !isOptionalTimestamp(endedAt) ||
    (endedAt !== null && endedAt < startedAt) ||
    !isSide(side) ||
    typeof periodCount !== 'number' || !Number.isSafeInteger(periodCount) || periodCount < 1 ||
    typeof lastPeriodId !== 'string' || lastPeriodId !== String(periodCount - 1).padStart(8, '0') ||
    !isTimestamp(lastPeriodStartedAt) || lastPeriodStartedAt < startedAt ||
    (endedAt !== null && lastPeriodStartedAt > endedAt) ||
    (createdByUid !== undefined && (typeof createdByUid !== 'string' || !createdByUid.trim())) ||
    (finishedByUid !== undefined && (typeof finishedByUid !== 'string' || !finishedByUid.trim())) ||
    (endedAt === null && finishedByUid !== undefined)
  ) {
    throw new Error('Resumo da mamada v2 inválido.');
  }

  return {
    id,
    startedAt,
    endedAt,
    side,
    periodCount,
    lastPeriodId,
    lastPeriodStartedAt,
    ...(createdByUid !== undefined ? { createdByUid } : {}),
    ...(finishedByUid !== undefined ? { finishedByUid } : {}),
  };
}

function parsePeriod(value: unknown): { index: number; period: FeedingPeriod } {
  if (!isRecord(value)) {
    throw new Error('Documento de período inválido.');
  }

  const keys = Object.keys(value);
  const allowed = ['id', 'index', 'startedAt', 'endedAt', 'side'];

  if (keys.some((key) => !allowed.includes(key))) {
    throw new Error('O período contém campos não permitidos.');
  }

  const index = value['index'];
  const startedAt = value['startedAt'];
  const endedAt = value['endedAt'];
  const side = value['side'];
  const id = value['id'];

  if (
    typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 ||
    (id !== undefined && id !== String(index).padStart(8, '0')) ||
    !isTimestamp(startedAt) ||
    !isOptionalTimestamp(endedAt) ||
    (endedAt !== null && endedAt < startedAt) ||
    !isSide(side)
  ) {
    throw new Error('Dados do período v2 inválidos.');
  }

  return { index, period: { startedAt, endedAt, side } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) &&
    value >= 0 && value <= 8_640_000_000_000_000;
}

function isOptionalTimestamp(value: unknown): value is number | null {
  return value === null || isTimestamp(value);
}

function isSide(value: unknown): value is FeedingSide | null {
  return value === null || value === 'left' || value === 'right';
}
