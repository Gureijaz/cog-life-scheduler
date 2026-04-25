import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskService } from './task';
import type { FlexibleTask } from '../types/domain';
import type { FlexibleTaskRepository } from '../repositories/entities';

function mockTaskRepo(overrides: Partial<FlexibleTaskRepository> = {}): FlexibleTaskRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (data) => ({ id: 't-1', ...data })),
    update: vi.fn().mockImplementation(async (id, data) => ({ id, ...data })),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as FlexibleTaskRepository;
}

const sampleTask: FlexibleTask = {
  id: 't-1',
  userId: 'u-1',
  title: 'Study Math',
  category: 'study',
  estimatedMinutes: 120,
  minSessionMinutes: 30,
  priority: 'high',
  dueDate: '2099-12-31',
  energyRequirement: 'high',
  preferredWindow: null,
  remainingMinutes: 120,
  createdAt: new Date(),
};

describe('TaskService', () => {
  let taskRepo: ReturnType<typeof mockTaskRepo>;
  let service: TaskService;

  beforeEach(() => {
    taskRepo = mockTaskRepo();
    service = new TaskService(taskRepo);
  });

  // ── createFlexibleTask ──────────────────────────────

  describe('createFlexibleTask', () => {
    it('stores all required fields with defaults', async () => {
      const result = await service.createFlexibleTask('u-1', {
        title: 'Study Math',
        category: 'study',
        estimatedMinutes: 120,
      });

      expect(taskRepo.create).toHaveBeenCalledOnce();
      const arg = (taskRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(arg.userId).toBe('u-1');
      expect(arg.title).toBe('Study Math');
      expect(arg.estimatedMinutes).toBe(120);
      expect(arg.minSessionMinutes).toBe(15);
      expect(arg.priority).toBe('medium');
      expect(arg.remainingMinutes).toBe(120);
      expect(result.id).toBe('t-1');
    });

    it('stores optional fields when provided', async () => {
      await service.createFlexibleTask('u-1', {
        title: 'Workout',
        category: 'fitness',
        estimatedMinutes: 60,
        minSessionMinutes: 30,
        priority: 'high',
        dueDate: '2099-06-01',
        energyRequirement: 'high',
        preferredWindow: { start: '06:00', end: '08:00' },
      });

      const arg = (taskRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(arg.minSessionMinutes).toBe(30);
      expect(arg.priority).toBe('high');
      expect(arg.dueDate).toBe('2099-06-01');
      expect(arg.energyRequirement).toBe('high');
      expect(arg.preferredWindow).toEqual({ start: '06:00', end: '08:00' });
    });

    it('rejects empty title', async () => {
      await expect(
        service.createFlexibleTask('u-1', { title: '', category: 'study', estimatedMinutes: 60 }),
      ).rejects.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });

    it('rejects zero duration', async () => {
      await expect(
        service.createFlexibleTask('u-1', { title: 'X', category: 'study', estimatedMinutes: 0 }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_DURATION' } });
    });

    it('rejects minSessionMinutes exceeding estimatedMinutes', async () => {
      await expect(
        service.createFlexibleTask('u-1', {
          title: 'X',
          category: 'study',
          estimatedMinutes: 30,
          minSessionMinutes: 60,
        }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_SESSION_LENGTH' } });
    });

    it('rejects past due date', async () => {
      await expect(
        service.createFlexibleTask('u-1', {
          title: 'X',
          category: 'study',
          estimatedMinutes: 60,
          dueDate: '2000-01-01',
        }),
      ).rejects.toMatchObject({ error: { code: 'PAST_DUE_DATE' } });
    });
  });

  // ── updateFlexibleTask ──────────────────────────────

  describe('updateFlexibleTask', () => {
    beforeEach(() => {
      (taskRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(sampleTask);
    });

    it('updates fields on an existing task', async () => {
      await service.updateFlexibleTask('t-1', { priority: 'critical' });
      expect(taskRepo.update).toHaveBeenCalledOnce();
    });

    it('throws NOT_FOUND for missing task', async () => {
      (taskRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      await expect(
        service.updateFlexibleTask('missing', { title: 'X' }),
      ).rejects.toMatchObject({ error: { code: 'NOT_FOUND' } });
    });
  });

  // ── deleteFlexibleTask ──────────────────────────────

  describe('deleteFlexibleTask', () => {
    it('deletes an existing task', async () => {
      (taskRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(sampleTask);
      await service.deleteFlexibleTask('t-1');
      expect(taskRepo.delete).toHaveBeenCalledWith('t-1');
    });

    it('throws NOT_FOUND for missing task', async () => {
      await expect(service.deleteFlexibleTask('missing')).rejects.toMatchObject({
        error: { code: 'NOT_FOUND' },
      });
    });
  });

  // ── getUnscheduledTasks ─────────────────────────────

  describe('getUnscheduledTasks', () => {
    it('returns only tasks with remainingMinutes > 0', async () => {
      const tasks: FlexibleTask[] = [
        { ...sampleTask, id: 't-1', remainingMinutes: 60 },
        { ...sampleTask, id: 't-2', remainingMinutes: 0 },
        { ...sampleTask, id: 't-3', remainingMinutes: 30 },
      ];
      (taskRepo.findByUser as ReturnType<typeof vi.fn>).mockResolvedValue(tasks);

      const result = await service.getUnscheduledTasks('u-1');
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(['t-1', 't-3']);
    });

    it('returns empty array when all tasks are complete', async () => {
      const tasks: FlexibleTask[] = [
        { ...sampleTask, id: 't-1', remainingMinutes: 0 },
      ];
      (taskRepo.findByUser as ReturnType<typeof vi.fn>).mockResolvedValue(tasks);

      const result = await service.getUnscheduledTasks('u-1');
      expect(result).toHaveLength(0);
    });
  });
});
