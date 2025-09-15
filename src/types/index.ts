/**
 * Core types and interfaces for the Mobile App Publisher
 * @fileoverview Defines all TypeScript interfaces, types, and enums used throughout the application
 */

import { z } from 'zod';

// Platform types
export type Platform = 'android' | 'ios';

export type DeploymentStatus = 'success' | 'failed' | 'skipped' | 'in-progress';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Validation schemas using Zod
export const PlatformSchema = z.enum(['android', 'ios']);

export const BaseInputSchema = z.object({
  platform: PlatformSchema,
  appVersion: z.string().min(1, 'App version is required'),
  buildNumber: z.string().optional(),
  releaseNotes: z.string().default(''),
  artifactPath: z.string().min(1, 'Artifact path is required'),
  dryRun: z.boolean().default(false),
  timeoutMinutes: z.number().min(1).max(120).default(30),
});

export const AndroidInputSchema = BaseInputSchema.extend({
  platform: z.literal('android'),
  googlePlayServiceAccountJson: z.string().min(1, 'Google Play service account JSON is required'),
  googlePlayPackageName: z.string().min(1, 'Google Play package name is required'),
  googlePlayTrack: z.enum(['production', 'beta', 'alpha', 'internal']).default('internal'),
});

export const IOSInputSchema = BaseInputSchema.extend({
  platform: z.literal('ios'),
  appStoreConnectApiKeyId: z.string().min(1, 'App Store Connect API Key ID is required'),
  appStoreConnectApiIssuerId: z.string().min(1, 'App Store Connect API Issuer ID is required'),
  appStoreConnectApiPrivateKey: z.string().min(1, 'App Store Connect API Private Key is required'),
  iosBundleId: z.string().min(1, 'iOS bundle ID is required'),
});

export const ActionInputSchema = z.discriminatedUnion('platform', [
  AndroidInputSchema,
  IOSInputSchema,
]);

// Inferred types from schemas
export type BaseInputs = z.infer<typeof BaseInputSchema>;
export type AndroidInputs = z.infer<typeof AndroidInputSchema>;
export type IOSInputs = z.infer<typeof IOSInputSchema>;
export type ActionInputs = z.infer<typeof ActionInputSchema>;

// Deployment result interfaces
export interface DeploymentResult {
  readonly status: DeploymentStatus;
  readonly platform: Platform;
  readonly deploymentId: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly duration: number;
  readonly deploymentUrl?: string;
  readonly versionCode?: string;
  readonly metadata?: Record<string, unknown>;
  error?: DeploymentError;
}

export interface AndroidDeploymentResult extends DeploymentResult {
  readonly platform: 'android';
  readonly packageName?: string;
  readonly track?: string;
  readonly versionCode?: string;
}

export interface IOSDeploymentResult extends DeploymentResult {
  readonly platform: 'ios';
  readonly bundleId?: string;
  readonly buildNumber?: string;
  readonly appVersion?: string;
}

// Error types
export class DeploymentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly platform?: Platform,
    public readonly details?: Record<string, unknown>,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'DeploymentError';
    Error.captureStackTrace(this, DeploymentError);
  }
}

export class ValidationError extends DeploymentError {
  constructor(
    message: string,
    public readonly validationErrors: string[]
  ) {
    super(message, 'VALIDATION_ERROR', undefined, { validationErrors }, false);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends DeploymentError {
  constructor(message: string, platform?: Platform, details?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', platform, details, false);
    this.name = 'AuthenticationError';
  }
}

export class NetworkError extends DeploymentError {
  constructor(message: string, platform?: Platform, details?: Record<string, unknown>) {
    super(message, 'NETWORK_ERROR', platform, details, true);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends DeploymentError {
  constructor(message: string, platform?: Platform) {
    super(message, 'TIMEOUT_ERROR', platform, undefined, true);
    this.name = 'TimeoutError';
  }
}

export class ArtifactError extends DeploymentError {
  constructor(message: string, platform?: Platform, details?: Record<string, unknown>) {
    super(message, 'ARTIFACT_ERROR', platform, details, false);
    this.name = 'ArtifactError';
  }
}

// Service interfaces
export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  group(name: string): void;
  groupEnd(): void;
  startGroup(name: string): void;
  endGroup(): void;
}

export interface IValidator {
  validate(inputs: Record<string, unknown>): Promise<ValidationResult>;
}

export interface IDeployer {
  deploy(inputs: ActionInputs): Promise<DeploymentResult>;
  validateArtifact(artifactPath: string): Promise<boolean>;
}

export interface IFileSystem {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, content: string | Buffer): Promise<void>;
  createTempFile(content: string | Buffer, extension?: string): Promise<string>;
  cleanupTempFile(path: string): Promise<void>;
  getFileSize(path: string): Promise<number>;
  getFileChecksum(path: string): Promise<string>;
}

export interface IHttpClient {
  get<T>(url: string, config?: RequestConfig): Promise<T>;
  post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T>;
  put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T>;
  delete<T>(url: string, config?: RequestConfig): Promise<T>;
  upload<T>(url: string, filePath: string, config?: RequestConfig): Promise<T>;
}

// Configuration interfaces
export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly initialDelay: number;
  readonly maxDelay: number;
  readonly backoffFactor: number;
  readonly shouldRetry: (error: Error) => boolean;
}

export interface TimeoutConfig {
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

// Google Play specific types
export interface GooglePlayAuth {
  readonly serviceAccountJson: string;
  readonly packageName: string;
}

export interface GooglePlayTrackInfo {
  readonly track: string;
  readonly versionCodes: string[];
  readonly status: string;
  readonly releaseNotes: Array<{
    language: string;
    text: string;
  }>;
}

// App Store Connect specific types
export interface AppStoreConnectAuth {
  readonly keyId: string;
  readonly issuerId: string;
  readonly privateKey: string;
}

export interface AppStoreConnectBuild {
  readonly id: string;
  readonly version: string;
  readonly buildNumber: string;
  readonly processingState: string;
}

// Action outputs
export interface ActionOutputs {
  readonly deploymentStatus: DeploymentStatus;
  readonly deploymentUrl?: string | undefined;
  readonly versionCode?: string | undefined;
  readonly deploymentId: string;
  readonly deploymentSummary: string; // JSON string
}

// Utility types
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Constants
export const PLATFORMS = ['android', 'ios'] as const;

export const GOOGLE_PLAY_TRACKS = ['production', 'beta', 'alpha', 'internal'] as const;

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  shouldRetry: (error: Error): boolean =>
    error instanceof NetworkError || error instanceof TimeoutError,
};
