import { describe, it, expect } from 'vitest';
import {
  toSnakeCase,
  toCamelCase,
  toSnakeCaseKeys,
  toCamelCaseKeys,
} from './serializer';

describe('serializer', () => {
  describe('toSnakeCase', () => {
    it('converts camelCase to snake_case', () => {
      expect(toSnakeCase('userId')).toBe('user_id');
      expect(toSnakeCase('createdAt')).toBe('created_at');
      expect(toSnakeCase('minBufferMinutes')).toBe('min_buffer_minutes');
    });

    it('leaves already snake_case strings unchanged', () => {
      expect(toSnakeCase('id')).toBe('id');
      expect(toSnakeCase('name')).toBe('name');
    });
  });

  describe('toCamelCase', () => {
    it('converts snake_case to camelCase', () => {
      expect(toCamelCase('user_id')).toBe('userId');
      expect(toCamelCase('created_at')).toBe('createdAt');
      expect(toCamelCase('min_buffer_minutes')).toBe('minBufferMinutes');
    });

    it('leaves already camelCase strings unchanged', () => {
      expect(toCamelCase('id')).toBe('id');
      expect(toCamelCase('name')).toBe('name');
    });
  });

  describe('toSnakeCaseKeys', () => {
    it('converts all object keys from camelCase to snake_case', () => {
      const input = { userId: '123', createdAt: new Date(), onboardingComplete: true };
      const result = toSnakeCaseKeys(input);
      expect(result).toHaveProperty('user_id', '123');
      expect(result).toHaveProperty('created_at');
      expect(result).toHaveProperty('onboarding_complete', true);
    });
  });

  describe('toCamelCaseKeys', () => {
    it('converts all object keys from snake_case to camelCase', () => {
      const row = { user_id: '123', created_at: '2025-01-01', onboarding_complete: false };
      const result = toCamelCaseKeys<{ userId: string; createdAt: string; onboardingComplete: boolean }>(row);
      expect(result.userId).toBe('123');
      expect(result.createdAt).toBe('2025-01-01');
      expect(result.onboardingComplete).toBe(false);
    });
  });
});
