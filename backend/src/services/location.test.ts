import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocationService } from './location';
import type { Location, TravelRule } from '../types/domain';
import type { LocationRepository, TravelRuleRepository } from '../repositories/entities';

function mockLocationRepo(overrides: Partial<LocationRepository> = {}): LocationRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (data) => ({ id: 'loc-1', ...data })),
    update: vi.fn().mockImplementation(async (id, data) => ({ id, ...data })),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as LocationRepository;
}

function mockTravelRuleRepo(overrides: Partial<TravelRuleRepository> = {}): TravelRuleRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (data) => ({ id: 'tr-1', ...data })),
    update: vi.fn().mockImplementation(async (id, data) => ({ id, ...data })),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as TravelRuleRepository;
}

const sampleLocation: Location = {
  id: 'loc-1',
  userId: 'u-1',
  name: 'Home',
  label: 'home',
  type: 'residence',
};

const sampleRule: TravelRule = {
  id: 'tr-1',
  userId: 'u-1',
  originId: 'loc-1',
  destinationId: 'loc-2',
  travelMinutes: 30,
};

describe('LocationService', () => {
  let locationRepo: ReturnType<typeof mockLocationRepo>;
  let travelRuleRepo: ReturnType<typeof mockTravelRuleRepo>;
  let service: LocationService;

  beforeEach(() => {
    locationRepo = mockLocationRepo();
    travelRuleRepo = mockTravelRuleRepo();
    service = new LocationService(locationRepo, travelRuleRepo);
  });

  // ── createLocation ──────────────────────────────────

  describe('createLocation', () => {
    it('stores all required fields', async () => {
      const result = await service.createLocation('u-1', {
        name: 'University',
        label: 'uni',
        type: 'education',
      });

      expect(locationRepo.create).toHaveBeenCalledOnce();
      const arg = (locationRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(arg.userId).toBe('u-1');
      expect(arg.name).toBe('University');
      expect(arg.label).toBe('uni');
      expect(arg.type).toBe('education');
      expect(result.id).toBe('loc-1');
    });

    it('rejects empty name', async () => {
      await expect(
        service.createLocation('u-1', { name: '', label: 'x', type: 'other' }),
      ).rejects.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });
  });

  // ── createTravelRule ────────────────────────────────

  describe('createTravelRule', () => {
    beforeEach(() => {
      // Both locations exist
      (locationRepo.findById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(sampleLocation)
        .mockResolvedValueOnce({ ...sampleLocation, id: 'loc-2', name: 'University' });
    });

    it('stores travel rule with valid inputs', async () => {
      const result = await service.createTravelRule('u-1', {
        originId: 'loc-1',
        destinationId: 'loc-2',
        travelMinutes: 25,
      });

      expect(travelRuleRepo.create).toHaveBeenCalledOnce();
      const arg = (travelRuleRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(arg.userId).toBe('u-1');
      expect(arg.originId).toBe('loc-1');
      expect(arg.destinationId).toBe('loc-2');
      expect(arg.travelMinutes).toBe(25);
      expect(result.id).toBe('tr-1');
    });

    it('rejects zero travel minutes', async () => {
      await expect(
        service.createTravelRule('u-1', {
          originId: 'loc-1',
          destinationId: 'loc-2',
          travelMinutes: 0,
        }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_DURATION' } });
    });

    it('rejects negative travel minutes', async () => {
      await expect(
        service.createTravelRule('u-1', {
          originId: 'loc-1',
          destinationId: 'loc-2',
          travelMinutes: -5,
        }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_DURATION' } });
    });

    it('rejects non-existent origin location', async () => {
      (locationRepo.findById as ReturnType<typeof vi.fn>).mockReset();
      (locationRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.createTravelRule('u-1', {
          originId: 'missing',
          destinationId: 'loc-2',
          travelMinutes: 10,
        }),
      ).rejects.toMatchObject({ error: { code: 'NOT_FOUND', details: { field: 'originId' } } });
    });

    it('rejects non-existent destination location', async () => {
      (locationRepo.findById as ReturnType<typeof vi.fn>).mockReset();
      (locationRepo.findById as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(sampleLocation)
        .mockResolvedValueOnce(null);

      await expect(
        service.createTravelRule('u-1', {
          originId: 'loc-1',
          destinationId: 'missing',
          travelMinutes: 10,
        }),
      ).rejects.toMatchObject({ error: { code: 'NOT_FOUND', details: { field: 'destinationId' } } });
    });
  });

  // ── updateTravelRule ────────────────────────────────

  describe('updateTravelRule', () => {
    beforeEach(() => {
      (travelRuleRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(sampleRule);
    });

    it('updates travel minutes on an existing rule', async () => {
      await service.updateTravelRule('tr-1', 45);
      expect(travelRuleRepo.update).toHaveBeenCalledWith('tr-1', { travelMinutes: 45 });
    });

    it('rejects zero travel minutes', async () => {
      await expect(service.updateTravelRule('tr-1', 0)).rejects.toMatchObject({
        error: { code: 'INVALID_DURATION' },
      });
    });

    it('rejects negative travel minutes', async () => {
      await expect(service.updateTravelRule('tr-1', -10)).rejects.toMatchObject({
        error: { code: 'INVALID_DURATION' },
      });
    });

    it('throws NOT_FOUND for missing rule', async () => {
      (travelRuleRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      await expect(service.updateTravelRule('missing', 20)).rejects.toMatchObject({
        error: { code: 'NOT_FOUND' },
      });
    });
  });

  // ── getTravelRules ──────────────────────────────────

  describe('getTravelRules', () => {
    it('returns all travel rules for a user', async () => {
      const rules: TravelRule[] = [
        sampleRule,
        { ...sampleRule, id: 'tr-2', originId: 'loc-2', destinationId: 'loc-1', travelMinutes: 35 },
      ];
      (travelRuleRepo.findByUser as ReturnType<typeof vi.fn>).mockResolvedValue(rules);

      const result = await service.getTravelRules('u-1');
      expect(result).toHaveLength(2);
      expect(travelRuleRepo.findByUser).toHaveBeenCalledWith('u-1');
    });

    it('returns empty array when no rules exist', async () => {
      const result = await service.getTravelRules('u-1');
      expect(result).toHaveLength(0);
    });
  });
});
