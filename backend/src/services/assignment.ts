// Assignment service — assignment CRUD, progress tracking, urgency
// Requirements: 4.1, 4.6, 4.7

import type { Assignment } from '../types/domain';
import type { CreateAssignmentInput, UpdateProgressInput } from '../types/api';
import type { AtRiskAssignment } from '../types/engine';
import type { AssignmentRepository } from '../repositories/entities';
import { validateAssignmentInput, validateProgressInput, validationError } from '../validation';
import { computeUrgency } from '../engine/urgency';

export class AssignmentService {
  constructor(private assignmentRepo: AssignmentRepository) {}

  /** Create a new assignment. Requirement 4.1 */
  async createAssignment(
    userId: string,
    data: CreateAssignmentInput,
  ): Promise<Assignment> {
    const validationErr = validateAssignmentInput(data);
    if (validationErr) throw validationErr;

    const now = new Date();
    const progressPercent = data.progressPercent ?? 0;
    const remainingMinutes = Math.round(
      data.estimatedTotalMinutes * (1 - progressPercent / 100),
    );

    const partial = {
      userId,
      title: data.title,
      subject: data.subject,
      deadline: new Date(data.deadline),
      estimatedTotalMinutes: data.estimatedTotalMinutes,
      progressPercent,
      urgencyScore: 0,
      remainingMinutes,
      createdAt: now,
    };

    // Compute initial urgency
    partial.urgencyScore = computeUrgency(partial as Assignment, now);

    return this.assignmentRepo.create(partial);
  }

  /** Update progress and recalculate urgency. Requirement 4.6 */
  async updateProgress(
    assignmentId: string,
    input: UpdateProgressInput,
  ): Promise<Assignment> {
    const validationErr = validateProgressInput(input);
    if (validationErr) throw validationErr;

    const existing = await this.assignmentRepo.findById(assignmentId);
    if (!existing) {
      throw validationError(
        'NOT_FOUND',
        `Assignment ${assignmentId} not found`,
        'assignmentId',
        'Assignment does not exist',
        assignmentId,
      );
    }

    const remainingMinutes = Math.round(
      existing.estimatedTotalMinutes * (1 - input.progressPercent / 100),
    );

    const updated: Partial<Assignment> = {
      progressPercent: input.progressPercent,
      remainingMinutes,
    };

    // Recalculate urgency with the new progress
    const projected = { ...existing, ...updated } as Assignment;
    updated.urgencyScore = computeUrgency(projected, new Date());

    return this.assignmentRepo.update(assignmentId, updated);
  }

  /** Get all assignments for a user with current urgency scores. */
  async getAssignmentsWithUrgency(userId: string): Promise<Assignment[]> {
    return this.assignmentRepo.findByUser(userId);
  }

  /** Get at-risk assignments (remaining work exceeds time before deadline). Requirement 4.7 */
  async getAtRiskAssignments(userId: string): Promise<AtRiskAssignment[]> {
    const assignments = await this.assignmentRepo.findByUser(userId);
    const now = new Date();
    const atRisk: AtRiskAssignment[] = [];

    for (const a of assignments) {
      if (a.progressPercent >= 100 || a.remainingMinutes <= 0) continue;

      const msUntilDeadline = a.deadline.getTime() - now.getTime();
      if (msUntilDeadline <= 0) continue;

      const minutesUntilDeadline = msUntilDeadline / 60_000;

      if (a.remainingMinutes > minutesUntilDeadline) {
        atRisk.push({
          assignmentId: a.id,
          title: a.title,
          deadline: a.deadline,
          remainingMinutes: a.remainingMinutes,
          availableMinutes: Math.round(minutesUntilDeadline),
          shortfallMinutes: Math.round(a.remainingMinutes - minutesUntilDeadline),
        });
      }
    }

    return atRisk;
  }
}
