/**
 * Professional Logger Service
 * @fileoverview Provides comprehensive logging capabilities with structured logging and GitHub Actions integration
 */

import * as core from '@actions/core';
import { ILogger, LogLevel } from '../types/index.js';

export class Logger implements ILogger {
  private readonly logLevel: LogLevel;
  private readonly enableTimestamps: boolean;
  private groupLevel: number = 0;

  constructor(logLevel: LogLevel = 'info', enableTimestamps: boolean = true) {
    this.logLevel = logLevel;
    this.enableTimestamps = enableTimestamps;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.logLevel];
  }

  private formatMessage(message: string, meta?: Record<string, unknown>): string {
    const indent = '  '.repeat(this.groupLevel);
    const timestamp = this.enableTimestamps ? `[${new Date().toISOString()}] ` : '';
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${indent}${timestamp}${message}${metaStr}`;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      core.debug(this.formatMessage(message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      core.info(this.formatMessage(message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      core.warning(this.formatMessage(message, meta));
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      core.error(this.formatMessage(message, meta));
    }
  }

  group(name: string): void {
    core.startGroup(name);
    this.groupLevel++;
  }

  groupEnd(): void {
    if (this.groupLevel > 0) {
      this.groupLevel--;
      core.endGroup();
    }
  }

  startGroup(name: string): void {
    this.group(name);
  }

  endGroup(): void {
    this.groupEnd();
  }

  // Utility methods for common logging patterns
  logDeploymentStart(platform: string, version: string): void {
    this.info(`🚀 Starting deployment to ${platform}`, { platform, version });
  }

  logDeploymentSuccess(platform: string, duration: number, url?: string): void {
    this.info(`✅ Successfully deployed to ${platform}`, {
      platform,
      duration: `${duration}ms`,
      url,
    });
  }

  logDeploymentFailure(platform: string, error: Error, duration: number): void {
    this.error(`❌ Failed to deploy to ${platform}`, {
      platform,
      error: error.message,
      duration: `${duration}ms`,
      stack: error.stack,
    });
  }

  logValidationResult(isValid: boolean, errors: string[], warnings: string[]): void {
    if (isValid) {
      this.info('✅ Input validation passed');
      if (warnings.length > 0) {
        warnings.forEach(warning => this.warn(`⚠️  ${warning}`));
      }
    } else {
      this.error('❌ Input validation failed', { errors });
    }
  }

  logArtifactInfo(path: string, size: number, checksum: string): void {
    this.info('📦 Artifact information', {
      path,
      size: `${(size / 1024 / 1024).toFixed(2)} MB`,
      checksum,
    });
  }

  logProgress(message: string, current: number, total: number): void {
    const percentage = Math.round((current / total) * 100);
    this.info(`⏳ ${message} (${current}/${total} - ${percentage}%)`);
  }

  logMetrics(metrics: Record<string, unknown>): void {
    this.info('📊 Deployment metrics', metrics);
  }
}

// Singleton instance for global use
export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || 'info',
  process.env.NODE_ENV !== 'test'
);
