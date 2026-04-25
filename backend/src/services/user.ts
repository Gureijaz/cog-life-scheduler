// User service — user CRUD and preference profile management
// Requirements: 1.1, 1.2, 1.3, 1.6

import type { User, PreferenceProfile } from '../types/domain';
import type { CreateUserInput, UpdatePreferencesInput, ErrorResponse } from '../types/api';
import type { UserRepository, PreferenceProfileRepository } from '../repositories/entities';
import { validatePreferencesInput, validationError } from '../validation';

export class UserService {
  constructor(
    private userRepo: UserRepository,
    private preferenceRepo: PreferenceProfileRepository,
  ) {}

  /** Create a new user record. Requirement 1.1 */
  async createUser(data: CreateUserInput): Promise<User> {
    const now = new Date();
    return this.userRepo.create({
      name: data.name,
      email: data.email,
      timezone: data.timezone ?? 'UTC',
      onboardingComplete: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Retrieve a user by id. Throws ErrorResponse-shaped object on 404. */
  async getUser(userId: string): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw validationError('NOT_FOUND', `User ${userId} not found`, 'userId', 'User does not exist', userId);
    }
    return user;
  }

  /** Update (or create) a user's preference profile. Requirements 1.2, 1.3, 1.6 */
  async updatePreferences(
    userId: string,
    prefs: UpdatePreferencesInput,
  ): Promise<PreferenceProfile> {
    // Ensure user exists
    await this.getUser(userId);

    // Validate preference inputs
    const validationErr = validatePreferencesInput(prefs);
    if (validationErr) {
      throw validationErr;
    }

    const existing = await this.preferenceRepo.findByUserId(userId);

    if (existing) {
      return this.preferenceRepo.update(existing.id, {
        ...prefs,
        updatedAt: new Date(),
      } as Partial<PreferenceProfile>);
    }

    // First-time creation with defaults for unset fields
    return this.preferenceRepo.create({
      userId,
      wakeTime: prefs.wakeTime ?? '07:00',
      sleepTime: prefs.sleepTime ?? '23:00',
      focusWindows: prefs.focusWindows ?? [],
      workoutWindows: prefs.workoutWindows ?? [],
      minBufferMinutes: prefs.minBufferMinutes ?? 5,
      maxDeepWorkMinutes: prefs.maxDeepWorkMinutes ?? 90,
      defaultCommuteMinutes: prefs.defaultCommuteMinutes ?? 15,
      autoRepairEnabled: prefs.autoRepairEnabled ?? false,
      updatedAt: new Date(),
    });
  }
}
