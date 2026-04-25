import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './user';
import type { User, PreferenceProfile } from '../types/domain';
import type { UserRepository, PreferenceProfileRepository } from '../repositories/entities';

// Minimal mock factories
function mockUserRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (data) => ({ id: 'u-1', ...data })),
    update: vi.fn().mockImplementation(async (id, data) => ({ id, ...data })),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as UserRepository;
}

function mockPrefRepo(overrides: Partial<PreferenceProfileRepository> = {}): PreferenceProfileRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findByUserId: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(async (data) => ({ id: 'p-1', ...data })),
    update: vi.fn().mockImplementation(async (id, data) => ({ id, ...data })),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as PreferenceProfileRepository;
}

const sampleUser: User = {
  id: 'u-1',
  name: 'Alice',
  email: 'alice@example.com',
  timezone: 'America/New_York',
  onboardingComplete: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UserService', () => {
  let userRepo: ReturnType<typeof mockUserRepo>;
  let prefRepo: ReturnType<typeof mockPrefRepo>;
  let service: UserService;

  beforeEach(() => {
    userRepo = mockUserRepo();
    prefRepo = mockPrefRepo();
    service = new UserService(userRepo, prefRepo);
  });

  // ── createUser ──────────────────────────────────────────

  describe('createUser', () => {
    it('creates a user with provided fields and defaults', async () => {
      const result = await service.createUser({ name: 'Alice', email: 'alice@example.com', timezone: 'America/New_York' });
      expect(userRepo.create).toHaveBeenCalledOnce();
      const arg = (userRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(arg.name).toBe('Alice');
      expect(arg.email).toBe('alice@example.com');
      expect(arg.timezone).toBe('America/New_York');
      expect(arg.onboardingComplete).toBe(false);
      expect(result.id).toBe('u-1');
    });

    it('defaults timezone to UTC when not provided', async () => {
      await service.createUser({ name: 'Bob', email: 'bob@example.com' });
      const arg = (userRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(arg.timezone).toBe('UTC');
    });
  });

  // ── getUser ─────────────────────────────────────────────

  describe('getUser', () => {
    it('returns the user when found', async () => {
      (userRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(sampleUser);
      const result = await service.getUser('u-1');
      expect(result).toEqual(sampleUser);
    });

    it('throws NOT_FOUND when user does not exist', async () => {
      await expect(service.getUser('missing')).rejects.toMatchObject({
        error: { code: 'NOT_FOUND' },
      });
    });
  });

  // ── updatePreferences ───────────────────────────────────

  describe('updatePreferences', () => {
    beforeEach(() => {
      // getUser needs to succeed
      (userRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(sampleUser);
    });

    it('creates a new preference profile when none exists', async () => {
      const result = await service.updatePreferences('u-1', { wakeTime: '08:00', sleepTime: '00:00' });
      expect(prefRepo.create).toHaveBeenCalledOnce();
      expect(result.wakeTime).toBe('08:00');
      expect(result.sleepTime).toBe('00:00');
    });

    it('updates an existing preference profile', async () => {
      const existing: PreferenceProfile = {
        id: 'p-1',
        userId: 'u-1',
        wakeTime: '07:00',
        sleepTime: '23:00',
        focusWindows: [],
        workoutWindows: [],
        minBufferMinutes: 5,
        maxDeepWorkMinutes: 90,
        defaultCommuteMinutes: 15,
        autoRepairEnabled: false,
        updatedAt: new Date(),
      };
      (prefRepo.findByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      await service.updatePreferences('u-1', { minBufferMinutes: 10 });
      expect(prefRepo.update).toHaveBeenCalledOnce();
    });

    it('throws validation error for invalid wake/sleep times', async () => {
      await expect(
        service.updatePreferences('u-1', { wakeTime: '08:00', sleepTime: '08:00' }),
      ).rejects.toMatchObject({
        error: { code: 'INVALID_SLEEP_SCHEDULE' },
      });
    });

    it('throws validation error for negative buffer minutes', async () => {
      await expect(
        service.updatePreferences('u-1', { minBufferMinutes: -1 }),
      ).rejects.toMatchObject({
        error: { code: 'INVALID_BUFFER' },
      });
    });

    it('throws NOT_FOUND when user does not exist', async () => {
      (userRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      await expect(
        service.updatePreferences('missing', { wakeTime: '08:00' }),
      ).rejects.toMatchObject({
        error: { code: 'NOT_FOUND' },
      });
    });
  });
});
