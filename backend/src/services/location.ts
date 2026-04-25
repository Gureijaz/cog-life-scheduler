// Location service — location and travel rule management
// Requirements: 5.1, 5.2, 5.6

import type { Location, TravelRule } from '../types/domain';
import type { CreateLocationInput, CreateTravelRuleInput } from '../types/api';
import type { LocationRepository, TravelRuleRepository } from '../repositories/entities';
import { validationError } from '../validation';

export class LocationService {
  constructor(
    private locationRepo: LocationRepository,
    private travelRuleRepo: TravelRuleRepository,
  ) {}

  /** Create a new location. Requirement 5.1 */
  async createLocation(
    userId: string,
    data: CreateLocationInput,
  ): Promise<Location> {
    if (!data.name || data.name.trim() === '') {
      throw validationError(
        'VALIDATION_ERROR',
        'Name is required',
        'name',
        'Name must not be empty',
        data.name,
      );
    }

    return this.locationRepo.create({
      userId,
      name: data.name,
      label: data.label,
      type: data.type,
    });
  }

  /** Create a travel rule between two locations. Requirement 5.2 */
  async createTravelRule(
    userId: string,
    data: CreateTravelRuleInput,
  ): Promise<TravelRule> {
    if (data.travelMinutes <= 0) {
      throw validationError(
        'INVALID_DURATION',
        'Travel minutes must be greater than zero',
        'travelMinutes',
        'Travel minutes must be > 0',
        data.travelMinutes,
      );
    }

    // Validate that both locations exist
    const origin = await this.locationRepo.findById(data.originId);
    if (!origin) {
      throw validationError(
        'NOT_FOUND',
        `Origin location ${data.originId} not found`,
        'originId',
        'Location does not exist',
        data.originId,
      );
    }

    const destination = await this.locationRepo.findById(data.destinationId);
    if (!destination) {
      throw validationError(
        'NOT_FOUND',
        `Destination location ${data.destinationId} not found`,
        'destinationId',
        'Location does not exist',
        data.destinationId,
      );
    }

    return this.travelRuleRepo.create({
      userId,
      originId: data.originId,
      destinationId: data.destinationId,
      travelMinutes: data.travelMinutes,
    });
  }

  /** Update travel time for an existing rule. Requirement 5.6 */
  async updateTravelRule(
    ruleId: string,
    travelMinutes: number,
  ): Promise<TravelRule> {
    if (travelMinutes <= 0) {
      throw validationError(
        'INVALID_DURATION',
        'Travel minutes must be greater than zero',
        'travelMinutes',
        'Travel minutes must be > 0',
        travelMinutes,
      );
    }

    const existing = await this.travelRuleRepo.findById(ruleId);
    if (!existing) {
      throw validationError(
        'NOT_FOUND',
        `Travel rule ${ruleId} not found`,
        'ruleId',
        'Travel rule does not exist',
        ruleId,
      );
    }

    return this.travelRuleRepo.update(ruleId, { travelMinutes });
  }

  /** Get all travel rules for a user. */
  async getTravelRules(userId: string): Promise<TravelRule[]> {
    return this.travelRuleRepo.findByUser(userId);
  }
}
