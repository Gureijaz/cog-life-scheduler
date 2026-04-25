// AI Assistant service — natural language schedule interaction
// Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 9.2, 9.4

import type {
  User,
  PreferenceProfile,
  ScheduleBlock,
  SchedulePlan,
} from '../types/domain';
import type { ScheduleChange } from '../types/engine';
import type { AIResponse } from '../types/api';
import type {
  UserRepository,
  PreferenceProfileRepository,
  SchedulePlanRepository,
  ScheduleBlockRepository,
  ExplanationRepository,
} from '../repositories/entities';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for the AI assistant service. */
export interface AIAssistantConfig {
  apiKey: string;
  model?: string;
  apiUrl?: string;
  timeoutMs?: number;
}

/** Minimal shape of the OpenAI chat completion response we care about. */
interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

// ---------------------------------------------------------------------------
// Helpers — date/time resolution
// ---------------------------------------------------------------------------

/**
 * Resolve "now" in the user's timezone.
 * Returns an object with the current Date and a formatted ISO date string.
 */
export function nowInTimezone(timezone: string): { now: Date; isoDate: string; timeStr: string } {
  const now = new Date();
  // Format date parts in the user's timezone
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const isoDate = formatter.format(now); // YYYY-MM-DD

  const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false });
  const timeStr = timeFmt.format(now); // HH:mm

  return { now, isoDate, timeStr };
}

/**
 * Build the system prompt that gives the LLM full context about the user's
 * schedule, available operations, timezone, and current time.
 */
export function buildSystemPrompt(
  user: User,
  preferences: PreferenceProfile | null,
  todayBlocks: ScheduleBlock[],
  timezone: string,
  currentDate: string,
  currentTime: string,
): string {
  const blockList =
    todayBlocks.length > 0
      ? todayBlocks
          .map(
            (b) =>
              `- [${b.startTime}–${b.endTime}] ${b.title} (${b.sourceType}${b.locked ? ', locked' : ''})`,
          )
          .join('\n')
      : '(no blocks scheduled today)';

  const prefsSection = preferences
    ? [
        `Wake time: ${preferences.wakeTime}`,
        `Sleep time: ${preferences.sleepTime}`,
        `Min buffer: ${preferences.minBufferMinutes} min`,
        `Max deep work block: ${preferences.maxDeepWorkMinutes} min`,
        `Default commute: ${preferences.defaultCommuteMinutes} min`,
      ].join('\n')
    : '(no preferences set)';

  return `You are Cog, an AI scheduling assistant. You help the user manage their daily schedule.

## Context
- User: ${user.name}
- Timezone: ${timezone}
- Current date: ${currentDate}
- Current time: ${currentTime}

## User Preferences
${prefsSection}

## Today's Schedule
${blockList}

## Available Operations
You can help the user with the following operations:
1. **create** — Create a new fixed event, flexible task, or assignment
2. **edit** — Edit an existing schedule item (change title, time, duration, priority, etc.)
3. **delete** — Delete a schedule item
4. **reschedule** — Move an item to a different time or date
5. **explain** — Explain why a schedule block was placed at its current time

## Instructions
- Parse the user's message and determine the intended operation (intent).
- Extract any structured fields from the message (title, date, time, duration, category, priority, etc.).
- Convert ALL relative date/time references to absolute values:
  - "tomorrow" → the day after ${currentDate}
  - "next Monday" → the next Monday after ${currentDate}
  - "after work" → after the last work/class block ends today
  - "morning" → between ${preferences?.wakeTime ?? '07:00'} and 12:00
  - "afternoon" → between 12:00 and 17:00
  - "evening" → between 17:00 and ${preferences?.sleepTime ?? '23:00'}
- If you cannot determine all required fields, set confirmationRequired to false and provide a followUpQuestion asking for the missing information.
- For create/edit/delete/reschedule operations, set confirmationRequired to true and provide a summary of the proposed changes.
- For explain operations, set confirmationRequired to false.
- If the message doesn't match any operation, use intent "unknown".

## Response Format
Respond with ONLY a JSON object (no markdown, no explanation) matching this schema:
{
  "intent": "create" | "edit" | "delete" | "reschedule" | "explain" | "unknown",
  "extractedFields": { ... },       // Partial fields extracted from the message
  "targetItemId": "...",            // ID of the item being edited/deleted/rescheduled (if identifiable)
  "proposedChanges": {              // For reschedule/edit operations
    "type": "add" | "modify" | "remove",
    "sourceType": "fixed_event" | "flexible_task" | "assignment",
    "sourceId": "...",
    "date": "YYYY-MM-DD",
    "details": { ... }
  },
  "followUpQuestion": "...",        // If required fields are missing
  "explanation": "...",             // For explain intent
  "confirmationRequired": true/false,
  "summary": "Human-readable summary of what will happen"
}`;
}

// ---------------------------------------------------------------------------
// LLM communication
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Call the OpenAI-compatible chat completions endpoint.
 * Uses native fetch — no external HTTP library required.
 */
export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  config: AIAssistantConfig,
): Promise<string> {
  const url = config.apiUrl ?? DEFAULT_API_URL;
  const model = config.model ?? DEFAULT_MODEL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`LLM API returned ${response.status}: ${text}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM returned empty content');
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

const VALID_INTENTS = new Set(['create', 'edit', 'delete', 'reschedule', 'explain', 'unknown']);

/** Human-readable list of supported operations for unknown intent responses. */
export const SUPPORTED_OPERATIONS_MESSAGE =
  'I can help you with the following: create a new event/task/assignment, edit an existing item, delete an item, reschedule an item to a different time, or explain why a block was placed at its current time.';

/**
 * Parse the raw LLM JSON string into a validated AIResponse.
 * Falls back to a sensible "unknown" response when parsing fails.
 */
export function parseLLMResponse(raw: string): AIResponse {
  // Strip markdown code fences if the LLM wraps its output
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned);

  const intent = VALID_INTENTS.has(parsed.intent) ? parsed.intent : 'unknown';

  return {
    intent: intent as AIResponse['intent'],
    extractedFields: parsed.extractedFields ?? undefined,
    targetItemId: parsed.targetItemId ?? undefined,
    proposedChanges: parseProposedChanges(parsed.proposedChanges),
    followUpQuestion: parsed.followUpQuestion ?? undefined,
    explanation: parsed.explanation ?? undefined,
    confirmationRequired: typeof parsed.confirmationRequired === 'boolean' ? parsed.confirmationRequired : true,
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'I processed your request.',
  };
}

function parseProposedChanges(raw: unknown): ScheduleChange | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const validTypes = new Set(['add', 'modify', 'remove']);
  const validSourceTypes = new Set(['fixed_event', 'flexible_task', 'assignment']);

  if (!validTypes.has(obj.type as string) || !validSourceTypes.has(obj.sourceType as string)) {
    return undefined;
  }

  return {
    type: obj.type as ScheduleChange['type'],
    sourceType: obj.sourceType as ScheduleChange['sourceType'],
    sourceId: typeof obj.sourceId === 'string' ? obj.sourceId : undefined,
    date: typeof obj.date === 'string' ? obj.date : '',
    details: typeof obj.details === 'object' && obj.details ? (obj.details as Record<string, unknown>) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Explanation rephrasing
// ---------------------------------------------------------------------------

/**
 * Rephrase a technical explanation into conversational plain language.
 * Preserves factual content while making it more readable.
 * Requirements: 9.4
 */
export function rephraseExplanation(technicalText: string): string {
  let text = technicalText;

  // Replace common technical patterns with conversational equivalents
  text = text.replace(/\bFixed_Event conflict\b/gi, 'a fixed commitment in your calendar');
  text = text.replace(/\bTravel_Rule between (\w+) and (\w+)\b/gi, 'the commute time from $1 to $2');
  text = text.replace(/\bTravel_Rule\b/gi, 'travel time between locations');
  text = text.replace(/\bAssignment deadline proximity\b/gi, 'your upcoming deadline');
  text = text.replace(/\bHard_Constraint\b/gi, 'a scheduling requirement');
  text = text.replace(/\bSoft_Constraint\b/gi, 'a scheduling preference');
  text = text.replace(/\bPreference_Profile\b/gi, 'your preferences');
  text = text.replace(/\bSchedule_Block\b/gi, 'time block');
  text = text.replace(/\bSchedule_Repair\b/gi, 'schedule adjustment');
  text = text.replace(/\bUrgency_Score\b/gi, 'urgency level');

  return text;
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class AIAssistantService {
  private config: AIAssistantConfig;

  constructor(
    private userRepo: UserRepository,
    private preferenceRepo: PreferenceProfileRepository,
    private planRepo: SchedulePlanRepository,
    private blockRepo: ScheduleBlockRepository,
    private explanationRepo: ExplanationRepository,
    config?: Partial<AIAssistantConfig>,
  ) {
    const apiKey = config?.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.config = {
      apiKey,
      model: config?.model,
      apiUrl: config?.apiUrl,
      timeoutMs: config?.timeoutMs,
    };
  }

  /**
   * Process a natural language message from the user.
   * Builds context, calls the LLM, and returns a structured AIResponse.
   *
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 9.2, 9.4
   */
  async processMessage(userId: string, message: string): Promise<AIResponse> {
    // 1. Fetch user context
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw Object.assign(new Error(`User ${userId} not found`), {
        error: { code: 'NOT_FOUND', message: `User ${userId} not found` },
      });
    }

    const preferences = await this.preferenceRepo.findByUserId(userId);
    const timezone = user.timezone || 'UTC';

    // 2. Get today's schedule blocks
    const { isoDate: currentDate, timeStr: currentTime } = nowInTimezone(timezone);
    const todayBlocks = await this.getTodayBlocks(userId, currentDate);

    // 3. Build system prompt
    const systemPrompt = buildSystemPrompt(
      user,
      preferences,
      todayBlocks,
      timezone,
      currentDate,
      currentTime,
    );

    // 4. Call LLM
    let rawResponse: string;
    try {
      rawResponse = await callLLM(systemPrompt, message, this.config);
    } catch (err: unknown) {
      // LLM timeout or network failure → user-friendly 503
      const msg = "I'm having trouble processing that right now. Please try again.";
      throw Object.assign(new Error(msg), {
        statusCode: 503,
        error: { code: 'SERVICE_UNAVAILABLE', message: msg },
      });
    }

    // 5. Parse structured response
    let response: AIResponse;
    try {
      response = parseLLMResponse(rawResponse);
    } catch {
      // Unparseable LLM response → ask user to rephrase
      return {
        intent: 'unknown',
        confirmationRequired: false,
        summary: "I couldn't understand the response. Could you rephrase your request?",
        followUpQuestion: 'Could you rephrase your request? I had trouble understanding that.',
      };
    }

    // 6. Post-processing based on intent

    // Req 8.7: Unknown intent → list supported operations
    if (response.intent === 'unknown' && !response.summary.includes('create')) {
      response = {
        ...response,
        summary: SUPPORTED_OPERATIONS_MESSAGE,
      };
    }

    // Req 9.2, 9.4: Explain intent → retrieve actual explanation and rephrase
    if (response.intent === 'explain' && response.targetItemId) {
      response = await this.enrichExplanation(response);
    }

    return response;
  }

  /**
   * For explain intents, retrieve the stored Explanation for the target block
   * and rephrase it into conversational language.
   * Requirements: 9.2, 9.4
   */
  private async enrichExplanation(response: AIResponse): Promise<AIResponse> {
    if (!response.targetItemId) return response;

    try {
      const explanation = await this.explanationRepo.findByBlock(response.targetItemId);
      if (explanation) {
        // Rephrase the technical explanation into conversational language
        const conversational = rephraseExplanation(explanation.explanationText);
        return {
          ...response,
          explanation: conversational,
          confirmationRequired: false,
        };
      }
    } catch {
      // If retrieval fails, fall back to LLM-generated explanation
    }
    return response;
  }

  /**
   * Retrieve today's schedule blocks for context building.
   */
  private async getTodayBlocks(userId: string, date: string): Promise<ScheduleBlock[]> {
    try {
      const plans = await this.planRepo.findByUserAndDate(userId, date);
      if (plans.length === 0) return [];

      const latest = plans.sort((a, b) => b.version - a.version)[0];
      const blocks = await this.blockRepo.findByPlan(latest.id);
      return blocks.sort((a, b) => {
        if (a.startTime < b.startTime) return -1;
        if (a.startTime > b.startTime) return 1;
        return 0;
      });
    } catch {
      return [];
    }
  }
}
