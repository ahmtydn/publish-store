/**
 * File System Service
 * @fileoverview Provides file system operations with error handling and validation
 */

import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import * as os from 'node:os';
import { IFileSystem } from '../types/index.js';
import { logger } from './logger.js';

export class FileSystemService implements IFileSystem {
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<Buffer> {
    try {
      logger.debug(`Reading file: ${filePath}`);
      return await fs.readFile(filePath);
    } catch (error) {
      logger.error(`Failed to read file: ${filePath}`, { error });
      throw new Error(
        `Failed to read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    try {
      logger.debug(`Writing file: ${filePath}`);

      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(filePath, content);
    } catch (error) {
      logger.error(`Failed to write file: ${filePath}`, { error });
      throw new Error(
        `Failed to write file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async createTempFile(content: string | Buffer, extension: string = '.tmp'): Promise<string> {
    try {
      const tempDir = os.tmpdir();
      const fileName = `publish-store-${Date.now()}-${Math.random().toString(36).substring(7)}${extension}`;
      const tempPath = path.join(tempDir, fileName);

      await this.writeFile(tempPath, content);
      logger.debug(`Created temporary file: ${tempPath}`);

      return tempPath;
    } catch (error) {
      logger.error('Failed to create temporary file', { error });
      throw new Error(
        `Failed to create temporary file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async cleanupTempFile(filePath: string): Promise<void> {
    try {
      if (await this.exists(filePath)) {
        await fs.unlink(filePath);
        logger.debug(`Cleaned up temporary file: ${filePath}`);
      }
    } catch (error) {
      logger.warn(`Failed to cleanup temporary file: ${filePath}`, { error });
      // Don't throw error for cleanup failures
    }
  }

  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      logger.error(`Failed to get file size: ${filePath}`, { error });
      throw new Error(
        `Failed to get file size ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getFileChecksum(filePath: string, algorithm: string = 'sha256'): Promise<string> {
    try {
      const content = await this.readFile(filePath);
      const hash = createHash(algorithm);
      hash.update(content);
      return hash.digest('hex');
    } catch (error) {
      logger.error(`Failed to calculate checksum: ${filePath}`, { error });
      throw new Error(
        `Failed to calculate checksum ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getFileInfo(filePath: string): Promise<{
    size: number;
    checksum: string;
    extension: string;
    basename: string;
    directory: string;
  }> {
    const [size, checksum] = await Promise.all([
      this.getFileSize(filePath),
      this.getFileChecksum(filePath),
    ]);

    return {
      size,
      checksum,
      extension: path.extname(filePath),
      basename: path.basename(filePath),
      directory: path.dirname(filePath),
    };
  }

  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create directory: ${dirPath}`, { error });
      throw new Error(
        `Failed to create directory ${dirPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async copyFile(source: string, destination: string): Promise<void> {
    try {
      // Ensure destination directory exists
      const destDir = path.dirname(destination);
      await this.ensureDirectory(destDir);

      await fs.copyFile(source, destination);
      logger.debug(`Copied file from ${source} to ${destination}`);
    } catch (error) {
      logger.error(`Failed to copy file from ${source} to ${destination}`, { error });
      throw new Error(
        `Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  isAbsolutePath(filePath: string): boolean {
    return path.isAbsolute(filePath);
  }

  resolvePath(...pathSegments: string[]): string {
    return path.resolve(...pathSegments);
  }

  joinPath(...pathSegments: string[]): string {
    return path.join(...pathSegments);
  }

  getExtension(filePath: string): string {
    return path.extname(filePath);
  }

  getBasename(filePath: string): string {
    return path.basename(filePath);
  }

  getDirname(filePath: string): string {
    return path.dirname(filePath);
  }
}
