/**
 * Core Action Implementation
 * @fileoverview Main orchestrator class that handles the entire mobile app publishing process
 */

import * as core from '@actions/core';
import {
  ActionInputs,
  DeploymentResult,
  ActionOutputs,
  DeploymentError,
  ValidationError,
  TimeoutError,
} from '../types/index.js';
import { logger } from '../services/logger.js';
import { InputValidator, parseActionInputs } from '../services/validator.js';
import { FileSystemService } from '../services/filesystem.js';
import { DeployerFactory } from '../deployers/deployer-factory.js';
import { withTimeout, formatDuration } from '../utils/helpers.js';

export class PublishStoreAction {
  private readonly validator: InputValidator;
  private readonly fileSystem: FileSystemService;
  private readonly deployerFactory: DeployerFactory;

  constructor(
    validator?: InputValidator,
    fileSystem?: FileSystemService,
    deployerFactory?: DeployerFactory
  ) {
    this.validator = validator ?? new InputValidator();
    this.fileSystem = fileSystem ?? new FileSystemService();
    this.deployerFactory = deployerFactory ?? new DeployerFactory();
  }

  /**
   * Main execution method for the GitHub Action
   */
  async run(): Promise<void> {
    const startTime = Date.now();
    let deploymentResult: DeploymentResult | undefined;

    try {
      logger.info('🚀 Starting Mobile App Publisher Action');
      logger.group('Initialization');

      // Parse and validate inputs
      const inputs = parseActionInputs();
      logger.info('📝 Parsed action inputs', {
        platform: inputs.platform,
        version: inputs.appVersion,
        dryRun: inputs.dryRun,
      });

      // Validate inputs
      const validationResult = await this.validator.validate(inputs);
      logger.logValidationResult(
        validationResult.isValid,
        validationResult.errors,
        validationResult.warnings
      );

      if (!validationResult.isValid) {
        throw new ValidationError('Input validation failed', validationResult.errors);
      }

      logger.groupEnd();

      // Perform deployment
      deploymentResult = await this.performDeployment(inputs);

      // Set action outputs
      this.setActionOutputs(deploymentResult);

      const duration = Date.now() - startTime;
      logger.logDeploymentSuccess(
        deploymentResult.platform,
        duration,
        deploymentResult.deploymentUrl
      );

      logger.info('✅ Mobile App Publisher Action completed successfully', {
        platform: deploymentResult.platform,
        duration: formatDuration(duration),
        status: deploymentResult.status,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const platform = deploymentResult?.platform ?? 'unknown';

      logger.logDeploymentFailure(
        platform,
        error instanceof Error ? error : new Error('Unknown error'),
        duration
      );

      // Set failure outputs if we have partial deployment result
      if (deploymentResult) {
        const failedResult: DeploymentResult = {
          ...deploymentResult,
          status: 'failed',
        };

        if (error instanceof Error) {
          failedResult.error = new DeploymentError(error.message, 'UNKNOWN_ERROR');
        }

        this.setActionOutputs(failedResult);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      core.setFailed(errorMessage);

      // Exit with error code for CI/CD systems
      process.exit(1);
    }
  }

  /**
   * Performs the actual deployment to the target platform
   */
  private async performDeployment(inputs: ActionInputs): Promise<DeploymentResult> {
    logger.group(`🎯 Deploying to ${inputs.platform.toUpperCase()}`);
    const startTime = Date.now();

    try {
      // Validate artifact exists and is correct type
      await this.validateArtifact(inputs);

      // Create platform-specific deployer
      const deployer = this.deployerFactory.createDeployer(inputs.platform);

      // Perform deployment with timeout
      logger.info(`📦 Starting deployment to ${inputs.platform}...`);
      const result = await withTimeout(deployer.deploy(inputs), {
        timeoutMs: inputs.timeoutMinutes * 60 * 1000,
        signal: new AbortController().signal,
      });

      const duration = Date.now() - startTime;
      logger.info(`✅ Deployment completed successfully in ${formatDuration(duration)}`);

      return {
        ...result,
        duration,
      } as DeploymentResult;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof Error) {
        // Enhance error with deployment context
        const deploymentError = new DeploymentError(
          error.message,
          error.constructor.name,
          inputs.platform,
          {
            duration,
            dryRun: inputs.dryRun,
            version: inputs.appVersion,
          },
          error instanceof TimeoutError
        );

        throw deploymentError;
      }

      throw error;
    } finally {
      logger.groupEnd();
    }
  }

  /**
   * Validates the artifact file before deployment
   */
  private async validateArtifact(inputs: ActionInputs): Promise<void> {
    logger.group('📋 Artifact Validation');

    try {
      // Check if artifact exists
      if (!(await this.fileSystem.exists(inputs.artifactPath))) {
        throw new DeploymentError(
          `Artifact file not found: ${inputs.artifactPath}`,
          'ARTIFACT_NOT_FOUND',
          inputs.platform
        );
      }

      // Get artifact information
      const artifactInfo = await this.fileSystem.getFileInfo(inputs.artifactPath);
      logger.logArtifactInfo(inputs.artifactPath, artifactInfo.size, artifactInfo.checksum);

      // Validate file extension
      const expectedExtension = inputs.platform === 'android' ? '.aab' : '.ipa';
      if (artifactInfo.extension.toLowerCase() !== expectedExtension) {
        throw new DeploymentError(
          `Invalid artifact type for ${inputs.platform}. Expected ${expectedExtension}, got ${artifactInfo.extension}`,
          'INVALID_ARTIFACT_TYPE',
          inputs.platform
        );
      }

      // Validate file size (reasonable limits)
      const maxSize = inputs.platform === 'android' ? 200 * 1024 * 1024 : 250 * 1024 * 1024; // 200MB Android, 250MB iOS
      if (artifactInfo.size > maxSize) {
        throw new DeploymentError(
          `Artifact size (${Math.round(artifactInfo.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(maxSize / 1024 / 1024)}MB)`,
          'ARTIFACT_TOO_LARGE',
          inputs.platform
        );
      }

      logger.info('✅ Artifact validation passed');
    } finally {
      logger.groupEnd();
    }
  }

  /**
   * Sets GitHub Action outputs based on deployment result
   */
  private setActionOutputs(result: DeploymentResult): void {
    const outputs: ActionOutputs = {
      deploymentStatus: result.status,
      deploymentUrl: result.deploymentUrl,
      versionCode: result.versionCode,
      deploymentId: result.deploymentId,
      deploymentSummary: JSON.stringify(
        {
          platform: result.platform,
          status: result.status,
          startTime: result.startTime.toISOString(),
          endTime: result.endTime.toISOString(),
          duration: result.duration,
          deploymentUrl: result.deploymentUrl,
          versionCode: result.versionCode,
          metadata: result.metadata,
          error: result.error
            ? {
                message: result.error.message,
                code: result.error.code,
                retryable: result.error.retryable,
              }
            : undefined,
        },
        null,
        2
      ),
    };

    // Set GitHub Action outputs
    core.setOutput('deployment_status', outputs.deploymentStatus);
    core.setOutput('deployment_id', outputs.deploymentId);
    core.setOutput('deployment_summary', outputs.deploymentSummary);

    if (outputs.deploymentUrl) {
      core.setOutput('deployment_url', outputs.deploymentUrl);
    }

    if (outputs.versionCode) {
      core.setOutput('version_code', outputs.versionCode);
    }

    logger.info('📊 Action outputs set', {
      status: outputs.deploymentStatus,
      deploymentId: outputs.deploymentId,
      hasUrl: !!outputs.deploymentUrl,
      hasVersionCode: !!outputs.versionCode,
    });
  }

  /**
   * Cleanup method for any temporary resources
   */
  async cleanup(): Promise<void> {
    try {
      logger.debug('🧹 Performing cleanup...');
      // Any cleanup operations would go here
      logger.debug('✅ Cleanup completed');
    } catch (error) {
      logger.warn('⚠️  Cleanup failed', { error });
      // Don't throw error for cleanup failures
    }
  }
}
