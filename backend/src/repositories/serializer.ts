// camelCase ↔ snake_case serialization for database rows
// Requirements: 12.1, 12.2

/**
 * Convert a camelCase string to snake_case.
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert a snake_case string to camelCase.
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Convert all keys of an object from camelCase to snake_case.
 * Used when writing domain objects to the database.
 */
export function toSnakeCaseKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[toSnakeCase(key)] = obj[key];
  }
  return result;
}

/**
 * Convert all keys of a database row from snake_case to camelCase.
 * Used when reading rows from the database into domain objects.
 */
export function toCamelCaseKeys<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    result[toCamelCase(key)] = row[key];
  }
  return result as T;
}
