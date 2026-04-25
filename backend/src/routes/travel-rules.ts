import { Router } from 'express';
import type { LocationService } from '../services/location';
import { getUserId, isErrorResponse, errorToStatus } from './helpers';

export function travelRuleRouter(locationService: LocationService): Router {
  const router = Router();

  // POST /api/travel-rules — Create travel rule
  router.post('/', async (req, res) => {
    try {
      const userId = getUserId(req);
      const { originId, destinationId, travelMinutes } = req.body;
      if (!originId || typeof originId !== 'string' || originId.trim() === '') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'originId is required', details: { field: 'originId', reason: 'Must be a valid location id' } } });
        return;
      }
      if (!destinationId || typeof destinationId !== 'string' || destinationId.trim() === '') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'destinationId is required', details: { field: 'destinationId', reason: 'Must be a valid location id' } } });
        return;
      }
      if (travelMinutes === undefined || typeof travelMinutes !== 'number') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'travelMinutes is required and must be a number', details: { field: 'travelMinutes', reason: 'Must be a positive number' } } });
        return;
      }
      const rule = await locationService.createTravelRule(userId, { originId, destinationId, travelMinutes });
      res.status(201).json(rule);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // PUT /api/travel-rules/:id — Update travel rule
  router.put('/:id', async (req, res) => {
    try {
      const { travelMinutes } = req.body;
      if (travelMinutes === undefined || typeof travelMinutes !== 'number') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'travelMinutes is required and must be a number', details: { field: 'travelMinutes', reason: 'Must be a positive number' } } });
        return;
      }
      const rule = await locationService.updateTravelRule(req.params.id, travelMinutes);
      res.json(rule);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // GET /api/travel-rules — List travel rules
  router.get('/', async (req, res) => {
    try {
      const userId = getUserId(req);
      const rules = await locationService.getTravelRules(userId);
      res.json(rules);
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
