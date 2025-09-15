/**
 * Base Deployer Interface
 * @fileoverview Abstract base class and interface for all platform deployers
 */

import {
  IDeployer,
  ActionInputs,
  DeploymentResult,
  Platform,
  DeploymentError,
} from '../types/index.js';
import { logger } from '../services/logger.js';
import { FileSystemService } from '../services/filesystem.js';
import { generateId } from '../utils/helpers.js';

export abstract class BaseDeployer implements IDeployer {
  protected readonly fileSystem: FileSystemService;
  protected readonly platform: Platform;

  constructor(platform: Platform, fileSystem?: FileSystemService) {
    this.platform = platform;
    this.fileSystem = fileSystem ?? new FileSystemService();
  }

  /**
   * Abstract method that each platform deployer must implement
   */
  abstract deploy(inputs: ActionInputs): Promise<DeploymentResult>;

  /**
   * Validates the artifact file for the specific platform
   */
  async validateArtifact(artifactPath: string): Promise<boolean> {
    try {
      // Check if file exists
      if (!(await this.fileSystem.exists(artifactPath))) {
        logger.error(`Artifact file not found: ${artifactPath}`);
        return false;
      }

      // Get file info
      const fileInfo = await this.fileSystem.getFileInfo(artifactPath);

      // Platform-specific validation
      const expectedExtension = this.getExpectedArtifactExtension();
      if (fileInfo.extension.toLowerCase() !== expectedExtension) {
        logger.error(
          `Invalid artifact extension. Expected ${expectedExtension}, got ${fileInfo.extension}`
        );
        return false;
      }

      // Size validation
      const maxSize = this.getMaxArtifactSize();
      if (fileInfo.size > maxSize) {
        logger.error(`Artifact too large: ${fileInfo.size} bytes, max: ${maxSize} bytes`);
        return false;
      }

      logger.info('✅ Artifact validation passed', {
        path: artifactPath,
        size: fileInfo.size,
        extension: fileInfo.extension,
        checksum: fileInfo.checksum,
      });

      return true;
    } catch (error) {
      logger.error('Artifact validation failed', { error, artifactPath });
      return false;
    }
  }

  /**
   * Creates a base deployment result with common fields
   */
  protected createBaseResult(
    _inputs: ActionInputs,
    status: 'success' | 'failed' | 'skipped' = 'success',
    startTime: Date = new Date(),
    endTime: Date = new Date()
  ): DeploymentResult {
    return {
      platform: this.platform,
      status,
      deploymentId: generateId(`${this.platform}-deploy`),
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
    };
  }

  /**
   * Handles deployment errors with proper context
   */
  protected handleDeploymentError(
    error: Error,
    context: {
      inputs: ActionInputs;
      startTime: Date;
      operation?: string;
    }
  ): DeploymentError {
    const { inputs, startTime, operation } = context;
    const duration = Date.now() - startTime.getTime();

    const deploymentError = new DeploymentError(
      error.message,
      error.constructor.name,
      this.platform,
      {
        operation,
        duration,
        version: inputs.appVersion,
        buildNumber: inputs.buildNumber,
        dryRun: inputs.dryRun,
      },
      this.isRetryableError(error)
    );

    logger.error(`Deployment error in ${operation || 'unknown operation'}`, {
      platform: this.platform,
      error: error.message,
      duration,
      retryable: deploymentError.retryable,
    });

    return deploymentError;
  }

  /**
   * Determines if an error is retryable
   * Override in platform-specific deployers for custom logic
   */
  protected isRetryableError(error: Error): boolean {
    // Network errors are generally retryable
    if (
      error.message.includes('network') ||
      error.message.includes('timeout') ||
      error.message.includes('ECONNRESET') ||
      error.message.includes('ETIMEDOUT')
    ) {
      return true;
    }

    // Rate limiting errors are retryable
    if (
      error.message.includes('rate limit') ||
      error.message.includes('429') ||
      error.message.includes('too many requests')
    ) {
      return true;
    }

    // Server errors (5xx) are retryable
    if (
      error.message.includes('500') ||
      error.message.includes('502') ||
      error.message.includes('503') ||
      error.message.includes('504')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Abstract method to get expected artifact extension for the platform
   */
  protected abstract getExpectedArtifactExtension(): string;

  /**
   * Abstract method to get maximum artifact size for the platform
   */
  protected abstract getMaxArtifactSize(): number;

  /**
   * Performs dry run validation
   */
  protected async performDryRun(inputs: ActionInputs): Promise<DeploymentResult> {
    logger.info('🏃 Performing dry run - no actual deployment will occur');

    const startTime = new Date();

    // Validate artifact
    const isValidArtifact = await this.validateArtifact(inputs.artifactPath);
    if (!isValidArtifact) {
      throw new DeploymentError(
        'Artifact validation failed during dry run',
        'DRY_RUN_VALIDATION_FAILED',
        this.platform
      );
    }

    // Platform-specific dry run validations
    await this.performPlatformSpecificDryRunValidations(inputs);

    const endTime = new Date();

    logger.info('✅ Dry run completed successfully');

    return {
      ...this.createBaseResult(inputs, 'success', startTime, endTime),
      deploymentUrl: this.getDryRunUrl(),
      versionCode: inputs.appVersion,
      metadata: {
        dryRun: true,
        validationsPassed: true,
      },
    };
  }

  /**
   * Platform-specific dry run validations
   * Override in platform deployers
   */
  protected async performPlatformSpecificDryRunValidations(_inputs: ActionInputs): Promise<void> {
    // Base implementation - override in platform deployers
    logger.debug('No platform-specific dry run validations implemented');
  }

  /**
   * Gets the dry run URL for the platform
   * Override in platform deployers
   */
  protected getDryRunUrl(): string {
    return `https://example.com/dry-run/${this.platform}`;
  }
}
