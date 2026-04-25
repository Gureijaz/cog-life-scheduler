import { Router } from 'express';
import type { EventService } from '../services/event';
import { getUserId, isErrorResponse, errorToStatus } from './helpers';

export function fixedEventRouter(eventService: EventService): Router {
  const router = Router();

  // POST /api/fixed-events — Create fixed event
  router.post('/', async (req, res) => {
    try {
      const userId = getUserId(req);
      const event = await eventService.createFixedEvent(userId, req.body);
      res.status(201).json(event);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // GET /api/fixed-events?date= — List fixed events for date
  router.get('/', async (req, res) => {
    try {
      const userId = getUserId(req);
      const date = req.query.date as string;
      if (!date) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Query parameter "date" is required', details: { field: 'date', reason: 'Date query parameter must be provided' } } });
        return;
      }
      const events = await eventService.getFixedEventsForDate(userId, date);
      res.json(events);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // PUT /api/fixed-events/:id — Update fixed event
  router.put('/:id', async (req, res) => {
    try {
      const event = await eventService.updateFixedEvent(req.params.id, req.body);
      res.json(event);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // PUT /api/fixed-events/:id/instances/:date — Update single recurrence instance
  router.put('/:id/instances/:date', async (req, res) => {
    try {
      const event = await eventService.updateRecurrenceInstance(
        req.params.id,
        req.params.date,
        req.body,
      );
      res.json(event);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      throw err;
    }
  });

  // DELETE /api/fixed-events/:id — Delete fixed event
  router.delete('/:id', async (req, res) => {
    try {
      await eventService.deleteFixedEvent(req.params.id);
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
