// Task service — flexible task CRUD
// Requirements: 3.1, 3.2, 3.3, 3.6, 3.7

import type { FlexibleTask } from '../types/domain';
import type { CreateFlexibleTaskInput } from '../types/api';
import type { FlexibleTaskRepository } from '../repositories/entities';
import { validateFlexibleTaskInput, validationError } from '../validation';

export class TaskService {
  constructor(private taskRepo: FlexibleTaskRepository) {}

  /** Create a new flexible task. Requirement 3.1 */
  async createFlexibleTask(
    userId: string,
    data: CreateFlexibleTaskInput,
  ): Promise<FlexibleTask> {
    const validationErr = validateFlexibleTaskInput(data);
    if (validationErr) throw validationErr;

    return this.taskRepo.create({
      userId,
      title: data.title,
      category: data.category,
      estimatedMinutes: data.estimatedMinutes,
      minSessionMinutes: data.minSessionMinutes ?? 15,
      priority: data.priority ?? 'medium',
      dueDate: data.dueDate ?? null,
      energyRequirement: data.energyRequirement ?? 'medium',
      preferredWindow: data.preferredWindow ?? null,
      remainingMinutes: data.estimatedMinutes,
      createdAt: new Date(),
    });
  }

  /** Update an existing flexible task. Requirement 3.6 */
  async updateFlexibleTask(
    taskId: string,
    data: Partial<CreateFlexibleTaskInput>,
  ): Promise<FlexibleTask> {
    const existing = await this.taskRepo.findById(taskId);
    if (!existing) {
      throw validationError('NOT_FOUND', `Flexible task ${taskId} not found`, 'taskId', 'Task does not exist', taskId);
    }

    return this.taskRepo.update(taskId, data as Partial<FlexibleTask>);
  }

  /** Delete a flexible task. */
  async deleteFlexibleTask(taskId: string): Promise<void> {
    const existing = await this.taskRepo.findById(taskId);
    if (!existing) {
      throw validationError('NOT_FOUND', `Flexible task ${taskId} not found`, 'taskId', 'Task does not exist', taskId);
    }

    await this.taskRepo.delete(taskId);
  }

  /** Get all unscheduled tasks (remainingMinutes > 0) for a user. */
  async getUnscheduledTasks(userId: string): Promise<FlexibleTask[]> {
    const tasks = await this.taskRepo.findByUser(userId);
    return tasks.filter((t) => t.remainingMinutes > 0);
  }
}
