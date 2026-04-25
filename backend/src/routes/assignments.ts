import { Router } from 'express';
import type { AssignmentService } from '../services/assignment';
import { getUserId, isErrorResponse, errorToStatus } from './helpers';

export function assignmentRouter(assignmentService: AssignmentService): Router {
  const router = Router();

  // POST /api/assignments — Create assignment
  router.post('/', async (req, res) => {
    try {
      const userId = getUserId(req);
      const assignment = await assignmentService.createAssignment(userId, req.body);
      res.status(201).json(assignment);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // GET /api/assignments — List assignments with urgency
  router.get('/', async (req, res) => {
    try {
      const userId = getUserId(req);
      const assignments = await assignmentService.getAssignmentsWithUrgency(userId);
      res.json(assignments);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // PUT /api/assignments/:id — Update assignment
  router.put('/:id', async (req, res) => {
    try {
      // The AssignmentService doesn't have a generic update method,
      // but we can use updateProgress for progress updates.
      // For a full update, we'd need to extend the service.
      // For now, delegate to the service's available methods.
      const userId = getUserId(req);
      const { progressPercent, ...otherFields } = req.body;

      // If only progress is being updated, use updateProgress
      if (progressPercent !== undefined && Object.keys(otherFields).length === 0) {
        const assignment = await assignmentService.updateProgress(req.params.id, { progressPercent });
        res.json(assignment);
        return;
      }

      // For general updates, use updateProgress if progress is included
      if (progressPercent !== undefined) {
        const assignment = await assignmentService.updateProgress(req.params.id, { progressPercent });
        res.json(assignment);
        return;
      }

      // No supported update fields
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No updatable fields provided', details: { reason: 'Provide progressPercent to update' } } });
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // PUT /api/assignments/:id/progress — Update progress
  router.put('/:id/progress', async (req, res) => {
    try {
      const { progressPercent } = req.body;
      if (progressPercent === undefined || typeof progressPercent !== 'number') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'progressPercent is required and must be a number', details: { field: 'progressPercent', reason: 'Must be a number between 0 and 100' } } });
        return;
      }
      const assignment = await assignmentService.updateProgress(req.params.id, { progressPercent });
      res.json(assignment);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  return router;
}
