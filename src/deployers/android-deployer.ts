/**
 * Android Google Play Store Deployer
 * @fileoverview Handles deployment to Google Play Store using Google Play Developer API
 */

import { google, androidpublisher_v3 } from 'googleapis';
import {
  ActionInputs,
  AndroidInputs,
  DeploymentResult,
  AndroidDeploymentResult,
  AuthenticationError,
  NetworkError,
  DeploymentError,
} from '../types/index.js';
import { BaseDeployer } from './base-deployer.js';
import { logger } from '../services/logger.js';
import { decodeBase64, generateId } from '../utils/helpers.js';

export class AndroidDeployer extends BaseDeployer {
  private androidPublisher: androidpublisher_v3.Androidpublisher | null = null;
  private packageName: string = '';

  constructor() {
    super('android');
  }

  async deploy(inputs: ActionInputs): Promise<DeploymentResult> {
    if (inputs.platform !== 'android') {
      throw new DeploymentError('Invalid platform for Android deployer', 'INVALID_PLATFORM');
    }

    const androidInputs = inputs as AndroidInputs;
    const startTime = new Date();

    try {
      logger.logDeploymentStart('Google Play Store', androidInputs.appVersion);

      // Handle dry run
      if (androidInputs.dryRun) {
        return await this.performDryRun(androidInputs);
      }

      // Initialize Google Play API
      await this.initializeGooglePlayAPI(androidInputs);

      // Validate artifact
      const isValidArtifact = await this.validateArtifact(androidInputs.artifactPath);
      if (!isValidArtifact) {
        throw new DeploymentError('Artifact validation failed', 'ARTIFACT_VALIDATION_FAILED');
      }

      // Perform deployment
      const result = await this.performGooglePlayDeployment(androidInputs, startTime);

      logger.info('✅ Android deployment completed successfully');
      return result;
    } catch (error) {
      const deploymentError = this.handleDeploymentError(error as Error, {
        inputs: androidInputs,
        startTime,
        operation: 'Google Play deployment',
      });
      throw deploymentError;
    }
  }

  private async initializeGooglePlayAPI(inputs: AndroidInputs): Promise<void> {
    try {
      logger.group('🔐 Initializing Google Play API');

      // Decode and parse service account JSON
      const serviceAccountJson = decodeBase64(inputs.googlePlayServiceAccountJson);
      const serviceAccount = JSON.parse(serviceAccountJson);

      // Validate service account structure
      this.validateServiceAccount(serviceAccount);

      // Create JWT authentication
      const auth = new google.auth.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });

      // Initialize Android Publisher API
      this.androidPublisher = google.androidpublisher({
        version: 'v3',
        auth: auth,
      });

      this.packageName = inputs.googlePlayPackageName;

      logger.info('✅ Google Play API initialized successfully', {
        packageName: this.packageName,
        serviceAccountEmail: serviceAccount.client_email,
      });
    } catch (error) {
      logger.error('Failed to initialize Google Play API', { error });
      throw new AuthenticationError(
        `Google Play API initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'android'
      );
    } finally {
      logger.groupEnd();
    }
  }

  private validateServiceAccount(serviceAccount: Record<string, unknown>): void {
    const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];

    for (const field of requiredFields) {
      if (!serviceAccount[field]) {
        throw new Error(`Missing required field in service account: ${field}`);
      }
    }

    if (serviceAccount.type !== 'service_account') {
      throw new Error('Service account must be of type "service_account"');
    }
  }

  private async performGooglePlayDeployment(
    inputs: AndroidInputs,
    startTime: Date
  ): Promise<AndroidDeploymentResult> {
    if (!this.androidPublisher) {
      throw new Error('Google Play API not initialized');
    }

    logger.group('📦 Google Play Store Deployment');

    try {
      // Create edit session
      const editId = await this.createEditSession();

      try {
        // Upload AAB
        const uploadResult = await this.uploadAAB(editId, inputs.artifactPath);
        logger.info('AAB uploaded successfully', { versionCode: uploadResult.versionCode });

        // Update track
        await this.updateTrack(editId, inputs, uploadResult.versionCode);

        // Commit edit session
        await this.commitEditSession(editId);

        const endTime = new Date();
        const deploymentUrl = `https://play.google.com/store/apps/details?id=${this.packageName}`;

        logger.info('✅ Google Play deployment completed successfully');

        return {
          platform: 'android',
          status: 'success',
          deploymentId: generateId('android-deploy'),
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
          deploymentUrl,
          versionCode: uploadResult.versionCode.toString(),
          packageName: this.packageName,
          track: inputs.googlePlayTrack,
          metadata: {
            packageName: this.packageName,
            track: inputs.googlePlayTrack,
            versionCode: uploadResult.versionCode,
            editId,
          },
        };
      } catch (error) {
        // Clean up edit session on error
        await this.cleanupEditSession(editId);
        throw error;
      }
    } finally {
      logger.groupEnd();
    }
  }

  private async createEditSession(): Promise<string> {
    if (!this.androidPublisher) {
      throw new Error('Google Play API not initialized');
    }

    try {
      logger.info('Creating edit session...');

      const response = await this.androidPublisher.edits.insert({
        packageName: this.packageName,
        requestBody: {},
      });

      if (!response.data.id) {
        throw new Error('Failed to create edit session - no edit ID returned');
      }

      logger.info('Edit session created', { editId: response.data.id });
      return response.data.id;
    } catch (error) {
      logger.error('Failed to create edit session', { error });
      throw new NetworkError(
        `Failed to create Google Play edit session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'android'
      );
    }
  }

  private async uploadAAB(editId: string, artifactPath: string): Promise<{ versionCode: number }> {
    if (!this.androidPublisher) {
      throw new Error('Google Play API not initialized');
    }

    try {
      logger.info('Uploading AAB file...', { path: artifactPath });

      const response = await this.androidPublisher.edits.bundles.upload({
        packageName: this.packageName,
        editId,
        media: {
          mimeType: 'application/octet-stream',
          body: require('fs').createReadStream(artifactPath),
        },
      });

      if (!response.data.versionCode) {
        throw new Error('Upload succeeded but no version code returned');
      }

      logger.info('AAB uploaded successfully', {
        versionCode: response.data.versionCode,
        sha256: response.data.sha256,
      });

      return { versionCode: response.data.versionCode };
    } catch (error) {
      logger.error('Failed to upload AAB', { error, artifactPath });
      throw new NetworkError(
        `Failed to upload AAB to Google Play: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'android'
      );
    }
  }

  private async updateTrack(
    editId: string,
    inputs: AndroidInputs,
    versionCode: number
  ): Promise<void> {
    if (!this.androidPublisher) {
      throw new Error('Google Play API not initialized');
    }

    try {
      logger.info('Updating release track...', {
        track: inputs.googlePlayTrack,
        versionCode,
      });

      // Prepare release notes
      const releaseNotes = inputs.releaseNotes
        ? [
            {
              language: 'en-US',
              text: inputs.releaseNotes,
            },
          ]
        : [];

      await this.androidPublisher.edits.tracks.update({
        packageName: this.packageName,
        editId,
        track: inputs.googlePlayTrack,
        requestBody: {
          track: inputs.googlePlayTrack,
          releases: [
            {
              name: `Release ${inputs.appVersion}`,
              versionCodes: [versionCode.toString()],
              status: 'completed',
              releaseNotes,
            },
          ],
        },
      });

      logger.info('Track updated successfully', { track: inputs.googlePlayTrack });
    } catch (error) {
      logger.error('Failed to update track', { error, track: inputs.googlePlayTrack });
      throw new NetworkError(
        `Failed to update Google Play track: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'android'
      );
    }
  }

  private async commitEditSession(editId: string): Promise<void> {
    if (!this.androidPublisher) {
      throw new Error('Google Play API not initialized');
    }

    try {
      logger.info('Committing edit session...');

      await this.androidPublisher.edits.commit({
        packageName: this.packageName,
        editId,
      });

      logger.info('Edit session committed successfully');
    } catch (error) {
      logger.error('Failed to commit edit session', { error, editId });
      throw new NetworkError(
        `Failed to commit Google Play edit session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'android'
      );
    }
  }

  private async cleanupEditSession(editId: string): Promise<void> {
    if (!this.androidPublisher) {
      return;
    }

    try {
      logger.info('Cleaning up edit session...', { editId });

      await this.androidPublisher.edits.delete({
        packageName: this.packageName,
        editId,
      });

      logger.info('Edit session cleaned up successfully');
    } catch (error) {
      logger.warn('Failed to cleanup edit session', { error, editId });
      // Don't throw - this is just cleanup
    }
  }

  protected getExpectedArtifactExtension(): string {
    return '.aab';
  }

  protected getMaxArtifactSize(): number {
    return 200 * 1024 * 1024; // 200MB
  }

  protected override async performPlatformSpecificDryRunValidations(
    inputs: ActionInputs
  ): Promise<void> {
    if (inputs.platform !== 'android') {
      return;
    }

    const androidInputs = inputs as AndroidInputs;

    // Initialize API to validate credentials
    await this.initializeGooglePlayAPI(androidInputs);

    logger.info('✅ Google Play API credentials validated successfully');
  }

  protected override getDryRunUrl(): string {
    return `https://play.google.com/console/developers (dry run - no actual deployment)`;
  }
}
