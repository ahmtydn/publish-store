/**
 * Utility Helper Functions
 * @fileoverview Common utility functions used throughout the application
 */

import { TimeoutConfig, TimeoutError, DeploymentError } from '../types/index.js';

/**
 * Formats duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * Executes a promise with timeout
 */
export async function withTimeout<T>(promise: Promise<T>, config: TimeoutConfig): Promise<T> {
  const { timeoutMs, signal } = config;

  return new Promise<T>((resolve, reject) => {
    // Set up timeout
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(`Operation timed out after ${formatDuration(timeoutMs)}`));
    }, timeoutMs);

    // Handle abort signal
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new DeploymentError('Operation was aborted', 'ABORTED'));
      });
    }

    // Execute the promise
    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Sleeps for the specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries an operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
    shouldRetry?: (error: Error) => boolean;
  }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on last attempt or if error is not retryable
      if (
        attempt === options.maxAttempts ||
        (options.shouldRetry && !options.shouldRetry(lastError))
      ) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        options.initialDelay * Math.pow(options.backoffFactor, attempt - 1),
        options.maxDelay
      );

      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Validates and normalizes a semantic version string
 */
export function normalizeVersion(version: string): string {
  // Remove 'v' prefix if present
  const cleanVersion = version.replace(/^v/, '');

  // Basic semver pattern
  const semverRegex =
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

  if (semverRegex.test(cleanVersion)) {
    return cleanVersion;
  }

  // Try to fix common version patterns
  const basicPattern = /^(\d+)\.(\d+)(?:\.(\d+))?$/;
  const match = cleanVersion.match(basicPattern);

  if (match) {
    const [, major, minor, patch] = match;
    return `${major}.${minor}.${patch || '0'}`;
  }

  throw new Error(`Invalid version format: ${version}`);
}

/**
 * Generates a unique identifier
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Safely parses JSON with error handling
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Checks if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes sensitive data from objects for logging
 */
export function sanitizeForLogging(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...obj };
  const sensitiveKeys = [
    'password',
    'secret',
    'key',
    'token',
    'auth',
    'credential',
    'private',
    'serviceAccount',
    'apiKey',
  ];

  for (const [key, value] of Object.entries(sanitized)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));

    if (isSensitive && typeof value === 'string') {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value as Record<string, unknown>);
    }
  }

  return sanitized;
}

/**
 * Validates a base64 string
 */
export function isValidBase64(str: string): boolean {
  try {
    return Buffer.from(str, 'base64').toString('base64') === str;
  } catch {
    return false;
  }
}

/**
 * Decodes a base64 string safely
 */
export function decodeBase64(encoded: string): string {
  if (!isValidBase64(encoded)) {
    throw new Error('Invalid base64 string');
  }
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

/**
 * Encodes a string to base64
 */
export function encodeBase64(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64');
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Creates a debounced version of a function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Creates a throttled version of a function
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
