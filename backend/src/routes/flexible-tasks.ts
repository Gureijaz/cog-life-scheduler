import { Router } from 'express';
import type { TaskService } from '../services/task';
import { getUserId, isErrorResponse, errorToStatus } from './helpers';

export function flexibleTaskRouter(taskService: TaskService): Router {
  const router = Router();

  // POST /api/flexible-tasks — Create flexible task
  router.post('/', async (req, res) => {
    try {
      const userId = getUserId(req);
      const task = await taskService.createFlexibleTask(userId, req.body);
      res.status(201).json(task);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // GET /api/flexible-tasks — List unscheduled tasks
  router.get('/', async (req, res) => {
    try {
      const userId = getUserId(req);
      const tasks = await taskService.getUnscheduledTasks(userId);
      res.json(tasks);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // PUT /api/flexible-tasks/:id — Update flexible task
  router.put('/:id', async (req, res) => {
    try {
      const task = await taskService.updateFlexibleTask(req.params.id, req.body);
      res.json(task);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // DELETE /api/flexible-tasks/:id — Delete flexible task
  router.delete('/:id', async (req, res) => {
    try {
      await taskService.deleteFlexibleTask(req.params.id);
      res.status(204).send();
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
