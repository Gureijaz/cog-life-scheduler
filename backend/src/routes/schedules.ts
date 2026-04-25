import { Router } from 'express';
import type { ScheduleService } from '../services/schedule';
import { getUserId, isErrorResponse, errorToStatus } from './helpers';

export function scheduleRouter(scheduleService: ScheduleService): Router {
  const router = Router();

  // POST /api/schedules/generate — Generate schedule for a date
  router.post('/generate', async (req, res) => {
    try {
      const userId = getUserId(req);
      const { date } = req.body;
      if (!date || typeof date !== 'string' || date.trim() === '') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'date is required',
            details: { field: 'date', reason: 'Must be a valid YYYY-MM-DD string' },
          },
        });
        return;
      }
      const result = await scheduleService.generateSchedule(userId, date);
      res.status(201).json(result);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // GET /api/schedules/week?start= — Get week plan
  // NOTE: This must be registered before /:id routes to avoid "week" matching as :id
  router.get('/week', async (req, res) => {
    try {
      const userId = getUserId(req);
      const start = req.query.start as string | undefined;
      if (!start || typeof start !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'start query parameter is required',
            details: { field: 'start', reason: 'Must be a valid YYYY-MM-DD string' },
          },
        });
        return;
      }
      const plans = await scheduleService.getWeekPlan(userId, start);
      res.json(plans);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // GET /api/schedules?date= — Get schedule plan for date
  router.get('/', async (req, res) => {
    try {
      const userId = getUserId(req);
      const date = req.query.date as string | undefined;
      if (!date || typeof date !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'date query parameter is required',
            details: { field: 'date', reason: 'Must be a valid YYYY-MM-DD string' },
          },
        });
        return;
      }
      const plan = await scheduleService.getSchedulePlan(userId, date);
      res.json(plan);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // POST /api/schedules/:id/repair — Repair existing schedule
  router.post('/:id/repair', async (req, res) => {
    try {
      const userId = getUserId(req);
      const planId = req.params.id;
      const { change } = req.body;
      if (!change || typeof change !== 'object') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'change is required',
            details: { field: 'change', reason: 'Must be a valid ScheduleChange object' },
          },
        });
        return;
      }
      const result = await scheduleService.repairSchedule(userId, planId, change);
      res.json(result);
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
