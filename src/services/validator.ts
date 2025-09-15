/**
 * Input Validator Service
 * @fileoverview Validates GitHub Action inputs with comprehensive error reporting and security checks
 */

import * as core from '@actions/core';
import {
  IValidator,
  ValidationResult,
  ActionInputs,
  ActionInputSchema,
  Platform,
  AndroidInputs,
  IOSInputs,
} from '../types/index.js';
import { logger } from './logger.js';
import { FileSystemService } from './filesystem.js';

export class InputValidator implements IValidator {
  constructor(private readonly fs: FileSystemService = new FileSystemService()) {}

  async validate(inputs: Record<string, unknown>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      logger.debug('Starting input validation', { inputs: this.sanitizeInputs(inputs) });

      // First, validate using Zod schema
      const parseResult = ActionInputSchema.safeParse(inputs);

      if (!parseResult.success) {
        const zodErrors = parseResult.error.errors.map(
          err => `${err.path.join('.')}: ${err.message}`
        );
        errors.push(...zodErrors);

        return {
          isValid: false,
          errors,
          warnings,
        };
      }

      const validatedInputs = parseResult.data;

      // Platform-specific validation
      if (validatedInputs.platform === 'android') {
        await this.validateAndroidInputs(validatedInputs, errors, warnings);
      } else if (validatedInputs.platform === 'ios') {
        await this.validateIOSInputs(validatedInputs, errors, warnings);
      }

      // Common validations
      await this.validateArtifact(
        validatedInputs.artifactPath,
        validatedInputs.platform,
        errors,
        warnings
      );
      this.validateVersionFormat(validatedInputs.appVersion, errors, warnings);
      this.validateTimeoutValue(validatedInputs.timeoutMinutes, warnings);

      logger.debug('Input validation completed', {
        errorsCount: errors.length,
        warningsCount: warnings.length,
      });

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      logger.error('Unexpected error during validation', { error });
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        isValid: false,
        errors,
        warnings,
      };
    }
  }

  private async validateAndroidInputs(
    inputs: AndroidInputs,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    // Validate Google Play service account JSON
    try {
      const serviceAccountData = this.decodeBase64(inputs.googlePlayServiceAccountJson);
      const parsed = JSON.parse(serviceAccountData);

      if (!parsed.type || parsed.type !== 'service_account') {
        errors.push('Google Play service account JSON must be a service account key');
      }

      if (!parsed.project_id) {
        errors.push('Google Play service account JSON must contain project_id');
      }

      if (!parsed.private_key) {
        errors.push('Google Play service account JSON must contain private_key');
      }

      if (!parsed.client_email) {
        errors.push('Google Play service account JSON must contain client_email');
      }
    } catch (error) {
      errors.push('Invalid Google Play service account JSON format');
    }

    // Validate package name format
    if (!this.isValidAndroidPackageName(inputs.googlePlayPackageName)) {
      errors.push('Invalid Android package name format');
    }

    // Validate track
    if (!['production', 'beta', 'alpha', 'internal'].includes(inputs.googlePlayTrack)) {
      errors.push('Invalid Google Play track. Must be one of: production, beta, alpha, internal');
    }

    // Warning for production track
    if (inputs.googlePlayTrack === 'production' && !inputs.dryRun) {
      warnings.push(
        'Deploying to production track. Consider using beta or alpha track for testing'
      );
    }
  }

  private async validateIOSInputs(
    inputs: IOSInputs,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    // Validate App Store Connect API key format
    if (!this.isValidApiKeyId(inputs.appStoreConnectApiKeyId)) {
      errors.push('Invalid App Store Connect API Key ID format');
    }

    // Validate issuer ID format (UUID)
    if (!this.isValidUUID(inputs.appStoreConnectApiIssuerId)) {
      errors.push('Invalid App Store Connect API Issuer ID format (must be UUID)');
    }

    // Validate private key
    try {
      const privateKeyData = this.decodeBase64(inputs.appStoreConnectApiPrivateKey);
      if (
        !privateKeyData.includes('BEGIN PRIVATE KEY') ||
        !privateKeyData.includes('END PRIVATE KEY')
      ) {
        errors.push('Invalid App Store Connect API Private Key format');
      }
    } catch (error) {
      errors.push('Invalid App Store Connect API Private Key encoding');
    }

    // Validate bundle ID format
    if (!this.isValidIOSBundleId(inputs.iosBundleId)) {
      errors.push('Invalid iOS bundle ID format');
    }

    // Warning for potential issues
    if (inputs.iosBundleId.includes('test') || inputs.iosBundleId.includes('debug')) {
      warnings.push(
        'Bundle ID contains test/debug keywords. Ensure this is correct for production'
      );
    }
  }

  private async validateArtifact(
    artifactPath: string,
    platform: Platform,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    // Check if file exists
    if (!(await this.fs.exists(artifactPath))) {
      errors.push(`Artifact file not found: ${artifactPath}`);
      return;
    }

    // Validate file extension
    const expectedExtension = platform === 'android' ? '.aab' : '.ipa';
    if (!artifactPath.toLowerCase().endsWith(expectedExtension)) {
      errors.push(`Invalid artifact type for ${platform}. Expected ${expectedExtension} file`);
    }

    // Check file size
    try {
      const fileSize = await this.fs.getFileSize(artifactPath);
      const maxSize = platform === 'android' ? 150 * 1024 * 1024 : 200 * 1024 * 1024; // 150MB for Android, 200MB for iOS

      if (fileSize > maxSize) {
        const maxSizeMB = Math.round(maxSize / 1024 / 1024);
        const actualSizeMB = Math.round(fileSize / 1024 / 1024);
        warnings.push(
          `Artifact size (${actualSizeMB}MB) is larger than recommended (${maxSizeMB}MB)`
        );
      }

      if (fileSize < 1024 * 1024) {
        // Less than 1MB
        warnings.push('Artifact size is unusually small, please verify the file is correct');
      }
    } catch (error) {
      warnings.push('Could not determine artifact file size');
    }
  }

  private validateVersionFormat(version: string, errors: string[], warnings: string[]): void {
    // Semantic version validation
    const semverRegex =
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

    if (!semverRegex.test(version)) {
      // More lenient validation for common patterns
      const basicVersionRegex = /^\d+\.\d+(\.\d+)?$/;
      if (!basicVersionRegex.test(version)) {
        errors.push(`Invalid version format: ${version}. Expected semantic version (e.g., 1.2.3)`);
      } else {
        warnings.push(
          `Version format could be improved. Consider using semantic versioning (e.g., ${version}.0)`
        );
      }
    }

    // Check for development versions in production
    if (version.includes('dev') || version.includes('debug') || version.includes('test')) {
      warnings.push(
        'Version contains development keywords. Ensure this is intended for production'
      );
    }
  }

  private validateTimeoutValue(timeoutMinutes: number, warnings: string[]): void {
    if (timeoutMinutes < 5) {
      warnings.push('Timeout value is very low, deployments might fail due to insufficient time');
    }

    if (timeoutMinutes > 60) {
      warnings.push('Timeout value is very high, consider if this is necessary');
    }
  }

  // Utility methods
  private decodeBase64(encoded: string): string {
    try {
      return Buffer.from(encoded, 'base64').toString('utf-8');
    } catch {
      throw new Error('Invalid base64 encoding');
    }
  }

  private isValidAndroidPackageName(packageName: string): boolean {
    const regex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
    return regex.test(packageName) && packageName.split('.').length >= 2;
  }

  private isValidIOSBundleId(bundleId: string): boolean {
    const regex = /^[a-zA-Z0-9]+(\.?[a-zA-Z0-9]+)*$/;
    return regex.test(bundleId) && bundleId.includes('.') && bundleId.split('.').length >= 2;
  }

  private isValidApiKeyId(keyId: string): boolean {
    // App Store Connect API Key ID format: 10 character alphanumeric
    const regex = /^[A-Z0-9]{10}$/;
    return regex.test(keyId);
  }

  private isValidUUID(uuid: string): boolean {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
  }

  private sanitizeInputs(inputs: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...inputs };

    // Remove or mask sensitive data for logging
    const sensitiveFields = ['googlePlayServiceAccountJson', 'appStoreConnectApiPrivateKey'];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

/**
 * Parses GitHub Action inputs into validated ActionInputs object
 */
export function parseActionInputs(): ActionInputs {
  const platform = core.getInput('platform', { required: true }) as Platform;

  const baseInputs = {
    platform,
    appVersion: core.getInput('app_version', { required: true }),
    buildNumber: core.getInput('build_number') || undefined,
    releaseNotes: core.getInput('release_notes') || '',
    artifactPath: core.getInput('artifact_path', { required: true }),
    skipDuplicateVersionCheck: core.getBooleanInput('skip_duplicate_version_check'),
    dryRun: core.getBooleanInput('dry_run'),
    timeoutMinutes: parseInt(core.getInput('timeout_minutes') || '30', 10),
  };

  if (platform === 'android') {
    return {
      ...baseInputs,
      platform: 'android',
      googlePlayServiceAccountJson: core.getInput('google_play_service_account_json', {
        required: true,
      }),
      googlePlayPackageName: core.getInput('google_play_package_name', { required: true }),
      googlePlayTrack: (core.getInput('google_play_track') || 'internal') as
        | 'production'
        | 'beta'
        | 'alpha'
        | 'internal',
    };
  } else {
    return {
      ...baseInputs,
      platform: 'ios',
      appStoreConnectApiKeyId: core.getInput('app_store_connect_api_key_id', { required: true }),
      appStoreConnectApiIssuerId: core.getInput('app_store_connect_api_issuer_id', {
        required: true,
      }),
      appStoreConnectApiPrivateKey: core.getInput('app_store_connect_api_private_key', {
        required: true,
      }),
      iosBundleId: core.getInput('ios_bundle_id', { required: true }),
    };
  }
}
