import { Router } from 'express';
import type { AIAssistantService } from '../services/ai-assistant';
import { getUserId, isErrorResponse, errorToStatus } from './helpers';

export function aiRouter(aiAssistantService: AIAssistantService): Router {
  const router = Router();

  // POST /api/ai/message — Send message to AI assistant
  router.post('/message', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message || typeof message !== 'string' || message.trim() === '') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Message is required',
            details: { field: 'message', reason: 'Message must be a non-empty string' },
          },
        });
        return;
      }

      const userId = getUserId(req);
      const result = await aiAssistantService.processMessage(userId, message);
      res.json(result);
    } catch (err) {
      if (isErrorResponse(err)) {
        res.status(errorToStatus(err)).json(err);
        return;
      }
      // Handle service errors with statusCode (e.g., 503 from LLM failure)
      if (err instanceof Error && 'statusCode' in err) {
        const statusCode = (err as Error & { statusCode: number }).statusCode;
        const errorBody = 'error' in err ? (err as Error & { error: object }).error : { code: 'INTERNAL_ERROR', message: err.message };
        res.status(statusCode).json({ error: errorBody });
        return;
      }
      throw err;
    }
  });

  return router;
}
