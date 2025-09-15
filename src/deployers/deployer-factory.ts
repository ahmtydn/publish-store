/**
 * Deployer Factory
 * @fileoverview Factory class for creating platform-specific deployers
 */

import { Platform, IDeployer } from '../types/index.js';
import { AndroidDeployer } from './android-deployer.js';
import { IOSDeployer } from './ios-deployer.js';

export class DeployerFactory {
  /**
   * Creates a deployer instance for the specified platform
   */
  createDeployer(platform: Platform): IDeployer {
    switch (platform) {
      case 'android':
        return new AndroidDeployer();
      case 'ios':
        return new IOSDeployer();
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Gets the list of supported platforms
   */
  getSupportedPlatforms(): Platform[] {
    return ['android', 'ios'];
  }

  /**
   * Checks if a platform is supported
   */
  isPlatformSupported(platform: string): platform is Platform {
    return this.getSupportedPlatforms().includes(platform as Platform);
  }
}
