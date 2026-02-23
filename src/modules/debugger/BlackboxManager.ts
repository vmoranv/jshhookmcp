import type { CDPSession } from 'rebrowser-puppeteer';
import { logger } from '../../utils/logger.js';

export class BlackboxManager {
  private blackboxedPatterns: Set<string> = new Set();

  static readonly COMMON_LIBRARY_PATTERNS = [
    '*jquery*.js',
    '*react*.js',
    '*react-dom*.js',
    '*vue*.js',
    '*angular*.js',
    '*lodash*.js',
    '*underscore*.js',
    '*moment*.js',
    '*axios*.js',
    '*node_modules/*',
    '*webpack*',
    '*bundle*.js',
    '*vendor*.js',
  ];

  constructor(private cdpSession: CDPSession) {
    logger.info('BlackboxManager initialized with shared CDP session');
  }

  async blackboxByPattern(urlPattern: string): Promise<void> {
    this.blackboxedPatterns.add(urlPattern);

    try {
      await this.cdpSession.send('Debugger.setBlackboxPatterns', {
        patterns: Array.from(this.blackboxedPatterns),
      });

      logger.info(`Blackboxed pattern: ${urlPattern}`);
    } catch (error) {
      logger.error('Failed to set blackbox pattern:', error);
      this.blackboxedPatterns.delete(urlPattern);
      throw error;
    }
  }

  async unblackboxByPattern(urlPattern: string): Promise<boolean> {
    const deleted = this.blackboxedPatterns.delete(urlPattern);
    if (!deleted) {
      return false;
    }

    try {
      await this.cdpSession.send('Debugger.setBlackboxPatterns', {
        patterns: Array.from(this.blackboxedPatterns),
      });

      logger.info(`Unblackboxed pattern: ${urlPattern}`);
      return true;
    } catch (error) {
      logger.error('Failed to remove blackbox pattern:', error);
      this.blackboxedPatterns.add(urlPattern);
      throw error;
    }
  }

  async blackboxCommonLibraries(): Promise<void> {
    for (const pattern of BlackboxManager.COMMON_LIBRARY_PATTERNS) {
      this.blackboxedPatterns.add(pattern);
    }

    try {
      await this.cdpSession.send('Debugger.setBlackboxPatterns', {
        patterns: Array.from(this.blackboxedPatterns),
      });

      logger.info(
        `Blackboxed ${BlackboxManager.COMMON_LIBRARY_PATTERNS.length} common library patterns`
      );
    } catch (error) {
      logger.error('Failed to blackbox common libraries:', error);
      throw error;
    }
  }

  getAllBlackboxedPatterns(): string[] {
    return Array.from(this.blackboxedPatterns);
  }

  async clearAllBlackboxedPatterns(): Promise<void> {
    this.blackboxedPatterns.clear();

    try {
      await this.cdpSession.send('Debugger.setBlackboxPatterns', {
        patterns: [],
      });

      logger.info('All blackbox patterns cleared');
    } catch (error) {
      logger.error('Failed to clear blackbox patterns:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.clearAllBlackboxedPatterns();
      logger.info('BlackboxManager closed');
    } catch (error) {
      logger.error('Failed to close BlackboxManager:', error);
      throw error;
    }
  }
}
