/**
 * Main Entry Point for Mobile App Publisher Action
 * @fileoverview GitHub Action entry point that orchestrates the entire mobile app publishing process
 */

import { PublishStoreAction } from './core/action.js';
import { logger } from './services/logger.js';

/**
 * Main function that runs the GitHub Action
 */
async function main(): Promise<void> {
  const action = new PublishStoreAction();

  try {
    await action.run();
  } catch (error) {
    // Error handling is done in the action itself
    // This catch is just to ensure the process exits with proper code
    logger.error('Action failed with unhandled error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  } finally {
    // Perform cleanup
    try {
      await action.cleanup();
    } catch (cleanupError) {
      logger.warn('Cleanup failed', {
        error: cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error',
      });
    }
  }
}

// Run the action if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Unhandled error in main', { error });
    process.exit(1);
  });
}

export { main };
export default main;
