import { Router } from 'express';
import type { LocationService } from '../services/location';
import { getUserId, isErrorResponse, errorToStatus } from './helpers';

export function locationRouter(locationService: LocationService): Router {
  const router = Router();

  // POST /api/locations — Create location
  router.post('/', async (req, res) => {
    try {
      const userId = getUserId(req);
      const { name, label, type } = req.body;
      if (!name || typeof name !== 'string' || name.trim() === '') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Name is required', details: { field: 'name', reason: 'Name must not be empty' } } });
        return;
      }
      if (!type || typeof type !== 'string' || type.trim() === '') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Type is required', details: { field: 'type', reason: 'Type must not be empty' } } });
        return;
      }
      const location = await locationService.createLocation(userId, { name, label: label ?? '', type });
      res.status(201).json(location);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // GET /api/locations — List locations for user
  router.get('/', async (req, res) => {
    try {
      const userId = getUserId(req);
      const locs = await locationService.getLocations(userId);
      res.json(locs);
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
