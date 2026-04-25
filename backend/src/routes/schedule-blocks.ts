import { Router } from 'express';
import type { ScheduleService } from '../services/schedule';
import { isErrorResponse, errorToStatus } from './helpers';

export function scheduleBlockRouter(scheduleService: ScheduleService): Router {
  const router = Router();

  // PUT /api/schedule-blocks/:id/lock — Lock a block
  router.put('/:id/lock', async (req, res) => {
    try {
      const block = await scheduleService.lockBlock(req.params.id);
      res.json(block);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // PUT /api/schedule-blocks/:id/unlock — Unlock a block
  router.put('/:id/unlock', async (req, res) => {
    try {
      const block = await scheduleService.unlockBlock(req.params.id);
      res.json(block);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // GET /api/schedule-blocks/:id/explanation — Get block explanation
  router.get('/:id/explanation', async (req, res) => {
    try {
      const explanation = await scheduleService.getExplanation(req.params.id);
      res.json(explanation);
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
