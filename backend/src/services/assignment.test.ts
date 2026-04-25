import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssignmentService } from './assignment';
import type { Assignment } from '../types/domain';
import type { AssignmentRepository } from '../repositories/entities';

function mockAssignmentRepo(overrides: Partial<AssignmentRepository> = {}): AssignmentRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (data) => ({ id: 'a-1', ...data })),
    update: vi.fn().mockImplementation(async (id, data) => ({ id, ...data })),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AssignmentRepository;
}

function futureDeadline(hoursFromNow: number): Date {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

const sampleAssignment: Assignment = {
  id: 'a-1',
  userId: 'u-1',
  title: 'Essay Draft',
  subject: 'English',
  deadline: futureDeadline(48),
  estimatedTotalMinutes: 180,
  progressPercent: 0,
  urgencyScore: 0,
  remainingMinutes: 180,
  createdAt: new Date(),
};

describe('AssignmentService', () => {
  let repo: ReturnType<typeof mockAssignmentRepo>;
  let service: AssignmentService;

  beforeEach(() => {
    repo = mockAssignmentRepo();
    service = new AssignmentService(repo);
  });

  // ── createAssignment ────────────────────────────────

  describe('createAssignment', () => {
    it('stores all required fields and computes urgency', async () => {
      const deadline = futureDeadline(24).toISOString();
      const result = await service.createAssignment('u-1', {
        title: 'Essay Draft',
        subject: 'English',
        deadline,
        estimatedTotalMinutes: 180,
      });

      expect(repo.create).toHaveBeenCalledOnce();
      const arg = (repo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(arg.userId).toBe('u-1');
      expect(arg.title).toBe('Essay Draft');
      expect(arg.subject).toBe('English');
      expect(arg.estimatedTotalMinutes).toBe(180);
      expect(arg.progressPercent).toBe(0);
      expect(arg.remainingMinutes).toBe(180);
      expect(typeof arg.urgencyScore).toBe('number');
      expect(arg.urgencyScore).toBeGreaterThanOrEqual(0);
      expect(arg.urgencyScore).toBeLessThanOrEqual(1);
      expect(result.id).toBe('a-1');
    });

    it('accepts initial progress and adjusts remainingMinutes', async () => {
      const deadline = futureDeadline(48).toISOString();
      await service.createAssignment('u-1', {
        title: 'Halfway Done',
        subject: 'Math',
        deadline,
        estimatedTotalMinutes: 200,
        progressPercent: 50,
      });

      const arg = (repo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(arg.progressPercent).toBe(50);
      expect(arg.remainingMinutes).toBe(100);
    });

    it('rejects empty title', async () => {
      await expect(
        service.createAssignment('u-1', {
          title: '',
          subject: 'Math',
          deadline: futureDeadline(24).toISOString(),
          estimatedTotalMinutes: 60,
        }),
      ).rejects.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });

    it('rejects zero duration', async () => {
      await expect(
        service.createAssignment('u-1', {
          title: 'X',
          subject: 'Math',
          deadline: futureDeadline(24).toISOString(),
          estimatedTotalMinutes: 0,
        }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_DURATION' } });
    });

    it('rejects past deadline', async () => {
      await expect(
        service.createAssignment('u-1', {
          title: 'X',
          subject: 'Math',
          deadline: '2000-01-01T00:00:00Z',
          estimatedTotalMinutes: 60,
        }),
      ).rejects.toMatchObject({ error: { code: 'PAST_DUE_DATE' } });
    });

    it('rejects invalid progress percentage', async () => {
      await expect(
        service.createAssignment('u-1', {
          title: 'X',
          subject: 'Math',
          deadline: futureDeadline(24).toISOString(),
          estimatedTotalMinutes: 60,
          progressPercent: 150,
        }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_PROGRESS' } });
    });
  });

  // ── updateProgress ──────────────────────────────────

  describe('updateProgress', () => {
    beforeEach(() => {
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(sampleAssignment);
    });

    it('recalculates remainingMinutes and urgencyScore', async () => {
      await service.updateProgress('a-1', { progressPercent: 50 });

      expect(repo.update).toHaveBeenCalledOnce();
      const [id, data] = (repo.update as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(id).toBe('a-1');
      expect(data.progressPercent).toBe(50);
      expect(data.remainingMinutes).toBe(90); // 180 * (1 - 0.5)
      expect(typeof data.urgencyScore).toBe('number');
    });

    it('sets remainingMinutes to 0 at 100% progress', async () => {
      await service.updateProgress('a-1', { progressPercent: 100 });

      const data = (repo.update as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(data.remainingMinutes).toBe(0);
      expect(data.urgencyScore).toBe(0);
    });

    it('throws NOT_FOUND for missing assignment', async () => {
      (repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      await expect(
        service.updateProgress('missing', { progressPercent: 50 }),
      ).rejects.toMatchObject({ error: { code: 'NOT_FOUND' } });
    });

    it('rejects progress out of range', async () => {
      await expect(
        service.updateProgress('a-1', { progressPercent: -10 }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_PROGRESS' } });

      await expect(
        service.updateProgress('a-1', { progressPercent: 101 }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_PROGRESS' } });
    });
  });

  // ── getAssignmentsWithUrgency ───────────────────────

  describe('getAssignmentsWithUrgency', () => {
    it('returns all assignments for the user', async () => {
      const assignments = [sampleAssignment, { ...sampleAssignment, id: 'a-2' }];
      (repo.findByUser as ReturnType<typeof vi.fn>).mockResolvedValue(assignments);

      const result = await service.getAssignmentsWithUrgency('u-1');
      expect(result).toHaveLength(2);
    });
  });

  // ── getAtRiskAssignments ────────────────────────────

  describe('getAtRiskAssignments', () => {
    it('returns assignments where remaining work exceeds time until deadline', async () => {
      // 300 remaining minutes but only ~60 minutes until deadline
      const atRiskAssignment: Assignment = {
        ...sampleAssignment,
        id: 'a-risk',
        remainingMinutes: 300,
        deadline: futureDeadline(1), // 1 hour = 60 minutes
      };
      (repo.findByUser as ReturnType<typeof vi.fn>).mockResolvedValue([atRiskAssignment]);

      const result = await service.getAtRiskAssignments('u-1');
      expect(result).toHaveLength(1);
      expect(result[0].assignmentId).toBe('a-risk');
      expect(result[0].shortfallMinutes).toBeGreaterThan(0);
    });

    it('excludes completed assignments', async () => {
      const completed: Assignment = {
        ...sampleAssignment,
        progressPercent: 100,
        remainingMinutes: 0,
      };
      (repo.findByUser as ReturnType<typeof vi.fn>).mockResolvedValue([completed]);

      const result = await service.getAtRiskAssignments('u-1');
      expect(result).toHaveLength(0);
    });

    it('excludes assignments with plenty of time', async () => {
      const safe: Assignment = {
        ...sampleAssignment,
        remainingMinutes: 60,
        deadline: futureDeadline(48), // 48 hours = 2880 minutes
      };
      (repo.findByUser as ReturnType<typeof vi.fn>).mockResolvedValue([safe]);

      const result = await service.getAtRiskAssignments('u-1');
      expect(result).toHaveLength(0);
    });
  });
});
