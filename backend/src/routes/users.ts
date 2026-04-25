import { Router } from 'express';
import type { UserService } from '../services/user';
import { getUserId, isErrorResponse, errorToStatus } from './helpers';

export function userRouter(userService: UserService): Router {
  const router = Router();

  // POST /api/users — Create user
  router.post('/', async (req, res) => {
    try {
      const { name, email, timezone } = req.body;
      if (!name || typeof name !== 'string' || name.trim() === '') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Name is required', details: { field: 'name', reason: 'Name must not be empty' } } });
        return;
      }
      if (!email || typeof email !== 'string' || email.trim() === '') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email is required', details: { field: 'email', reason: 'Email must not be empty' } } });
        return;
      }
      const user = await userService.createUser({ name, email, timezone });
      res.status(201).json(user);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // GET /api/users/:id — Get user
  router.get('/:id', async (req, res) => {
    try {
      const user = await userService.getUser(req.params.id);
      res.json(user);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // PUT /api/users/:id/preferences — Update preferences
  router.put('/:id/preferences', async (req, res) => {
    try {
      const prefs = await userService.updatePreferences(req.params.id, req.body);
      res.json(prefs);
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
