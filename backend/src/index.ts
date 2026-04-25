import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authMiddleware, errorMiddleware } from './middleware';
import {
  userRouter,
  fixedEventRouter,
  flexibleTaskRouter,
  assignmentRouter,
  locationRouter,
  travelRuleRouter,
  scheduleRouter,
  scheduleBlockRouter,
  aiRouter,
} from './routes';
import { UserService } from './services/user';
import { EventService } from './services/event';
import { TaskService } from './services/task';
import { AssignmentService } from './services/assignment';
import { LocationService } from './services/location';
import { ScheduleService } from './services/schedule';
import { AIAssistantService } from './services/ai-assistant';
import { getPool } from './db/pool';
import {
  UserRepository,
  PreferenceProfileRepository,
  FixedEventRepository,
  FlexibleTaskRepository,
  AssignmentRepository,
  LocationRepository,
  TravelRuleRepository,
  SchedulePlanRepository,
  ScheduleBlockRepository,
  ExplanationRepository,
} from './repositories';

const app = express();

// CORS — allow frontend origin
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3000'];
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json());
app.use(authMiddleware);

const PORT = process.env.PORT || 3001;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// --- Repositories ---
const dbPool = getPool();
const userRepo = new UserRepository(dbPool);
const preferenceRepo = new PreferenceProfileRepository(dbPool);
const fixedEventRepo = new FixedEventRepository(dbPool);
const flexibleTaskRepo = new FlexibleTaskRepository(dbPool);
const assignmentRepo = new AssignmentRepository(dbPool);
const locationRepo = new LocationRepository(dbPool);
const travelRuleRepo = new TravelRuleRepository(dbPool);
const schedulePlanRepo = new SchedulePlanRepository(dbPool);
const scheduleBlockRepo = new ScheduleBlockRepository(dbPool);
const explanationRepo = new ExplanationRepository(dbPool);

// --- Services ---
const userService = new UserService(userRepo, preferenceRepo);
const eventService = new EventService(fixedEventRepo, schedulePlanRepo, scheduleBlockRepo);
const taskService = new TaskService(flexibleTaskRepo);
const assignmentService = new AssignmentService(assignmentRepo);
const locationService = new LocationService(locationRepo, travelRuleRepo);
const scheduleService = new ScheduleService(
  dbPool,
  preferenceRepo,
  fixedEventRepo,
  flexibleTaskRepo,
  assignmentRepo,
  travelRuleRepo,
  schedulePlanRepo,
  scheduleBlockRepo,
  explanationRepo,
);
const aiAssistantService = new AIAssistantService(
  userRepo,
  preferenceRepo,
  schedulePlanRepo,
  scheduleBlockRepo,
  explanationRepo,
);

// --- Routes ---
app.use('/api/users', userRouter(userService));
app.use('/api/fixed-events', fixedEventRouter(eventService));
app.use('/api/flexible-tasks', flexibleTaskRouter(taskService));
app.use('/api/assignments', assignmentRouter(assignmentService));
app.use('/api/locations', locationRouter(locationService));
app.use('/api/travel-rules', travelRuleRouter(locationService));
app.use('/api/schedules', scheduleRouter(scheduleService));
app.use('/api/schedule-blocks', scheduleBlockRouter(scheduleService));
app.use('/api/ai', aiRouter(aiAssistantService));

// Error handling middleware must be registered last
app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Cog backend listening on port ${PORT}`);
});

export default app;
