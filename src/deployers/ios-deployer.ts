/**
 * iOS App Store Connect Deployer
 * @fileoverview Handles deployment to Apple App Store using xcrun altool for real uploads
 */

import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  ActionInputs,
  IOSInputs,
  DeploymentResult,
  IOSDeploymentResult,
  AuthenticationError,
  NetworkError,
  DeploymentError,
} from '../types/index.js';
import { BaseDeployer } from './base-deployer.js';
import { logger } from '../services/logger.js';
import { decodeBase64, generateId } from '../utils/helpers.js';

export class IOSDeployer extends BaseDeployer {
  constructor() {
    super('ios');
  }

  async deploy(inputs: ActionInputs): Promise<DeploymentResult> {
    if (inputs.platform !== 'ios') {
      throw new DeploymentError('Invalid platform for iOS deployer', 'INVALID_PLATFORM');
    }

    const iosInputs = inputs as IOSInputs;
    const startTime = new Date();

    try {
      logger.logDeploymentStart('App Store Connect', iosInputs.appVersion);

      // Handle dry run
      if (iosInputs.dryRun) {
        return await this.performDryRun(iosInputs);
      }

      // Validate inputs
      this.validateIOSInputs(iosInputs);

      // Check system requirements
      await this.checkSystemRequirements();

      // Validate artifact
      const isValidArtifact = await this.validateArtifact(iosInputs.artifactPath);
      if (!isValidArtifact) {
        throw new DeploymentError('Artifact validation failed', 'ARTIFACT_VALIDATION_FAILED');
      }

      // Perform real upload using xcrun altool
      const result = await this.performRealAppStoreUpload(iosInputs, startTime);

      logger.info('✅ iOS deployment completed successfully');
      return result;
    } catch (error) {
      const deploymentError = this.handleDeploymentError(error as Error, {
        inputs: iosInputs,
        startTime,
        operation: 'App Store Connect upload',
      });
      throw deploymentError;
    }
  }

  private validateIOSInputs(inputs: IOSInputs): void {
    if (!inputs.appStoreConnectApiKeyId) {
      throw new DeploymentError('App Store Connect API Key ID is required', 'MISSING_API_KEY_ID');
    }

    if (!inputs.appStoreConnectApiIssuerId) {
      throw new DeploymentError('App Store Connect API Issuer ID is required', 'MISSING_ISSUER_ID');
    }

    if (!inputs.appStoreConnectApiPrivateKey) {
      throw new DeploymentError(
        'App Store Connect API Private Key is required',
        'MISSING_PRIVATE_KEY'
      );
    }

    if (!inputs.iosBundleId) {
      throw new DeploymentError('iOS Bundle ID is required', 'MISSING_BUNDLE_ID');
    }

    logger.debug('iOS inputs validated successfully');
  }

  private async checkSystemRequirements(): Promise<void> {
    try {
      logger.info('🔍 Checking system requirements for iOS deployment...');

      // Check if we're running on macOS
      if (process.platform !== 'darwin') {
        logger.warn('⚠️  iOS deployment typically requires macOS for optimal compatibility');
      }

      // Check if Xcode command line tools are available
      try {
        execSync('xcrun --version', { stdio: 'pipe' });
        logger.info('✅ Xcode command line tools are available');
      } catch (error) {
        logger.warn('⚠️  Xcode command line tools not found. Some features may be limited.');
      }

      // Check if altool is available (newer Xcode versions)
      try {
        execSync('xcrun altool --version', { stdio: 'pipe' });
        logger.info('✅ xcrun altool is available');
      } catch (error) {
        // Try notarytool as alternative (Xcode 13+)
        try {
          execSync('xcrun notarytool --version', { stdio: 'pipe' });
          logger.info('✅ xcrun notarytool is available (will use as fallback)');
        } catch (notaryError) {
          throw new DeploymentError(
            'Neither xcrun altool nor notarytool is available. Please install Xcode command line tools.',
            'MISSING_XCODE_TOOLS'
          );
        }
      }

      logger.info('✅ System requirements check completed');
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error;
      }
      throw new DeploymentError(
        `System requirements check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SYSTEM_CHECK_FAILED'
      );
    }
  }

  private async performRealAppStoreUpload(
    inputs: IOSInputs,
    startTime: Date
  ): Promise<IOSDeploymentResult> {
    logger.group('📤 Real App Store Connect Upload');

    try {
      // Create temporary API key file for altool authentication
      const apiKeyPath = await this.createTemporaryApiKeyFile(inputs);

      try {
        // Upload the IPA using xcrun altool
        await this.uploadWithAltool(inputs.artifactPath, apiKeyPath, inputs);

        const endTime = new Date();
        const deploymentUrl = `https://appstoreconnect.apple.com/apps`;

        logger.info('✅ Real App Store upload completed successfully');

        return {
          platform: 'ios',
          status: 'success',
          deploymentId: generateId('ios-upload'),
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
          deploymentUrl,
          versionCode: inputs.appVersion,
          bundleId: inputs.iosBundleId,
          ...(inputs.buildNumber && { buildNumber: inputs.buildNumber }),
          appVersion: inputs.appVersion,
          metadata: {
            bundleId: inputs.iosBundleId,
            uploadMethod: 'xcrun altool',
            realUpload: true,
          },
        };
      } finally {
        // Clean up temporary API key file
        await this.cleanupTemporaryApiKeyFile(apiKeyPath);
      }
    } finally {
      logger.groupEnd();
    }
  }

  private async createTemporaryApiKeyFile(inputs: IOSInputs): Promise<string> {
    try {
      logger.debug('Creating temporary API key file for altool authentication...');

      // Decode the private key
      const privateKey = decodeBase64(inputs.appStoreConnectApiPrivateKey);

      // Create temporary directory
      const tempDir = os.tmpdir();
      const keyFileName = `AuthKey_${inputs.appStoreConnectApiKeyId}.p8`;
      const keyFilePath = path.join(tempDir, keyFileName);

      // Write the private key to temporary file
      await fs.writeFile(keyFilePath, privateKey, 'utf8');

      logger.debug('Temporary API key file created', { path: keyFilePath });
      return keyFilePath;
    } catch (error) {
      logger.error('Failed to create temporary API key file', { error });
      throw new DeploymentError(
        `Failed to create API key file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_KEY_FILE_CREATION_FAILED'
      );
    }
  }

  private async cleanupTemporaryApiKeyFile(keyFilePath: string): Promise<void> {
    try {
      await fs.unlink(keyFilePath);
      logger.debug('Temporary API key file cleaned up', { path: keyFilePath });
    } catch (error) {
      logger.warn('Failed to cleanup temporary API key file', { error, path: keyFilePath });
      // Don't throw error for cleanup failures
    }
  }

  private async uploadWithAltool(
    ipaPath: string,
    apiKeyPath: string,
    inputs: IOSInputs
  ): Promise<void> {
    try {
      logger.info('🚀 Starting real IPA upload with xcrun altool...', {
        ipaPath,
        bundleId: inputs.iosBundleId,
      });

      // Verify IPA file exists
      try {
        await fs.access(ipaPath);
      } catch (error) {
        throw new DeploymentError(`IPA file not found: ${ipaPath}`, 'IPA_FILE_NOT_FOUND');
      }

      // Get file size for progress tracking
      const stats = await fs.stat(ipaPath);
      const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
      logger.info(`📦 Uploading IPA file (${fileSizeMB} MB)...`);

      // Construct altool command
      const altoolCommand = [
        'xcrun altool',
        '--upload-app',
        `--file "${ipaPath}"`,
        '--type ios',
        `--apiKey "${inputs.appStoreConnectApiKeyId}"`,
        `--apiIssuer "${inputs.appStoreConnectApiIssuerId}"`,
        `--apiKeyPath "${path.dirname(apiKeyPath)}"`,
        '--verbose',
      ].join(' ');

      logger.debug('Executing altool command (credentials hidden)');

      // Execute the upload command
      const startTime = Date.now();

      try {
        const output = execSync(altoolCommand, {
          stdio: 'pipe',
          encoding: 'utf8',
          timeout: 30 * 60 * 1000, // 30 minutes timeout
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });

        const duration = Date.now() - startTime;
        logger.info('✅ IPA uploaded successfully to App Store Connect', {
          duration: `${(duration / 1000).toFixed(1)}s`,
          fileSizeMB,
        });

        // Log altool output (sanitized)
        if (output) {
          const sanitizedOutput = this.sanitizeAltoolOutput(output);
          logger.debug('altool output:', { output: sanitizedOutput });
        }

        // Check for success indicators in output
        if (output.includes('No errors uploading')) {
          logger.info('🎉 Upload verification: No errors reported by altool');
        } else if (output.includes('Package Summary:')) {
          logger.info('📋 Upload completed with package summary');
        }
      } catch (execError: any) {
        const duration = Date.now() - startTime;

        // Parse altool error output
        const errorOutput = execError.stderr || execError.stdout || execError.message;
        const sanitizedError = this.sanitizeAltoolOutput(errorOutput);

        logger.error('❌ altool upload failed', {
          duration: `${(duration / 1000).toFixed(1)}s`,
          error: sanitizedError,
          exitCode: execError.status,
        });

        // Provide specific error guidance
        this.handleAltoolError(sanitizedError);
      }
    } catch (error) {
      logger.error('Failed to upload with altool', { error });
      throw new DeploymentError(
        `App Store upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ALTOOL_UPLOAD_FAILED'
      );
    }
  }

  private sanitizeAltoolOutput(output: string): string {
    // Remove sensitive information from altool output
    return output
      .replace(/apiKey="[^"]*"/g, 'apiKey="***"')
      .replace(/apiIssuer="[^"]*"/g, 'apiIssuer="***"')
      .replace(/--apiKey\s+\S+/g, '--apiKey ***')
      .replace(/--apiIssuer\s+\S+/g, '--apiIssuer ***');
  }

  private handleAltoolError(errorOutput: string): never {
    // Common altool error patterns and solutions
    if (errorOutput.includes('Unable to authenticate')) {
      throw new AuthenticationError(
        'App Store Connect authentication failed. Please verify your API credentials.',
        'ios',
        { suggestion: 'Check API Key ID, Issuer ID, and Private Key are correct' }
      );
    }

    if (errorOutput.includes('Invalid bundle identifier')) {
      throw new DeploymentError(
        'Invalid bundle identifier in IPA file',
        'INVALID_BUNDLE_ID',
        'ios',
        { suggestion: 'Ensure the IPA bundle ID matches your App Store Connect app' }
      );
    }

    if (errorOutput.includes('The provided entity name is not unique')) {
      throw new DeploymentError(
        'A build with this version already exists',
        'DUPLICATE_VERSION',
        'ios',
        { suggestion: 'Increment the build number in your app and rebuild' }
      );
    }

    if (errorOutput.includes('Invalid provisioning profile')) {
      throw new DeploymentError(
        'Invalid provisioning profile in IPA',
        'INVALID_PROVISIONING_PROFILE',
        'ios',
        { suggestion: 'Ensure your IPA is signed with a valid App Store distribution profile' }
      );
    }

    if (errorOutput.includes('Network error')) {
      throw new NetworkError(
        'Network error during upload. Please check your internet connection and try again.',
        'ios',
        { retryable: true }
      );
    }

    // Generic error fallback
    throw new DeploymentError(`App Store upload failed: ${errorOutput}`, 'ALTOOL_ERROR', 'ios', {
      suggestion: 'Check the altool output above for specific error details',
      rawError: errorOutput,
    });
  }

  protected getExpectedArtifactExtension(): string {
    return '.ipa';
  }

  protected getMaxArtifactSize(): number {
    return 250 * 1024 * 1024; // 250MB
  }

  protected override async performPlatformSpecificDryRunValidations(
    inputs: ActionInputs
  ): Promise<void> {
    if (inputs.platform !== 'ios') {
      return;
    }

    const iosInputs = inputs as IOSInputs;

    // For dry run, just validate that we have all required inputs
    this.validateIOSInputs(iosInputs);

    logger.info('✅ iOS deployment inputs validated successfully');
  }

  protected override getDryRunUrl(): string {
    return `https://appstoreconnect.apple.com (dry run - no actual deployment)`;
  }
}
