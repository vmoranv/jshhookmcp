import { logger } from '../../utils/logger.js';

export interface PackerDeobfuscatorOptions {
  code: string;
  maxIterations?: number;
}

export interface PackerDeobfuscatorResult {
  code: string;
  success: boolean;
  iterations: number;
  warnings: string[];
}

export class PackerDeobfuscator {
  static detect(code: string): boolean {
    const packerPattern =
      /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*[dr]\s*\)/;
    return packerPattern.test(code);
  }

  async deobfuscate(options: PackerDeobfuscatorOptions): Promise<PackerDeobfuscatorResult> {
    const { code, maxIterations = 5 } = options;

    logger.info(' Packer...');

    const warnings: string[] = [];
    let currentCode = code;
    let iterations = 0;

    try {
      while (PackerDeobfuscator.detect(currentCode) && iterations < maxIterations) {
        const unpacked = this.unpack(currentCode);

        if (!unpacked || unpacked === currentCode) {
          warnings.push('');
          break;
        }

        currentCode = unpacked;
        iterations++;
        logger.info(`  ${iterations} `);
      }

      logger.info(`Packer deobfuscation complete in ${iterations} iterations`);

      return {
        code: currentCode,
        success: true,
        iterations,
        warnings,
      };
    } catch (error) {
      logger.error('Packer', error);
      return {
        code: currentCode,
        success: false,
        iterations,
        warnings: [...warnings, String(error)],
      };
    }
  }

  private unpack(code: string): string {
    const match = code.match(
      /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*[dr]\s*\)\s*{([\s\S]*?)}\s*\((.*?)\)\s*\)/
    );

    if (!match || !match[2]) {
      return code;
    }

    const args = match[2];

    const params = this.parsePackerParams(args);
    if (!params) {
      return code;
    }

    try {
      const unpacked = this.executeUnpacker(params);
      return unpacked || code;
    } catch (error) {
      logger.warn('', error);
      return code;
    }
  }

  private parsePackerParams(argsString: string): {
    p: string;
    a: number;
    c: number;
    k: string[];
    e: Function;
    d: Function;
  } | null {
    try {
      const parseFunc = new Function(`return [${argsString}];`);
      const params = parseFunc();

      if (params.length < 4) {
        return null;
      }

      return {
        p: params[0] || '',
        a: params[1] || 0,
        c: params[2] || 0,
        k: (params[3] || '').split('|'),
        e:
          params[4] ||
          function (c: any) {
            return c;
          },
        d:
          params[5] ||
          function () {
            return '';
          },
      };
    } catch {
      return null;
    }
  }

  private executeUnpacker(params: {
    p: string;
    a: number;
    c: number;
    k: string[];
    e: Function;
    d: Function;
  }): string {
    const { p, a, k } = params;
    let { c } = params;

    let result = p;

    while (c--) {
      const replacement = k[c];
      if (replacement) {
        const pattern = new RegExp('\\b' + this.base(c, a) + '\\b', 'g');
        result = result.replace(pattern, replacement);
      }
    }

    return result;
  }

  private base(num: number, radix: number): string {
    const digits = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    if (num === 0) {
      return '0';
    }

    let result = '';
    while (num > 0) {
      result = digits[num % radix] + result;
      num = Math.floor(num / radix);
    }

    return result || '0';
  }

  beautify(code: string): string {
    let result = code;

    result = result.replace(/;/g, ';\n');
    result = result.replace(/{/g, '{\n');
    result = result.replace(/}/g, '\n}\n');

    result = result.replace(/\n\n+/g, '\n\n');

    return result.trim();
  }
}

export class AAEncodeDeobfuscator {
  static detect(code: string): boolean {
    return code.includes('゜-゜') || code.includes('ω゜') || code.includes('o゜)');
  }

  async deobfuscate(code: string): Promise<string> {
    logger.info(' AAEncode...');

    try {
      const decoded = new Function(`return (${code})`)();

      logger.info(' AAEncode');
      return decoded;
    } catch (error) {
      logger.error('AAEncode', error);
      return code;
    }
  }
}

export class URLEncodeDeobfuscator {
  static detect(code: string): boolean {
    const percentCount = (code.match(/%[0-9A-Fa-f]{2}/g) || []).length;
    return percentCount > 10;
  }

  async deobfuscate(code: string): Promise<string> {
    logger.info(' URLEncode...');

    try {
      const decoded = decodeURIComponent(code);
      logger.info(' URLEncode');
      return decoded;
    } catch (error) {
      logger.error('URLEncode', error);
      return code;
    }
  }
}

export class UniversalUnpacker {
  private packerDeobfuscator = new PackerDeobfuscator();
  private aaencodeDeobfuscator = new AAEncodeDeobfuscator();
  private urlencodeDeobfuscator = new URLEncodeDeobfuscator();

  async deobfuscate(code: string): Promise<{
    code: string;
    type: string;
    success: boolean;
  }> {
    logger.info(' ...');

    if (PackerDeobfuscator.detect(code)) {
      logger.info(': Packer');
      const result = await this.packerDeobfuscator.deobfuscate({ code });
      return {
        code: result.code,
        type: 'Packer',
        success: result.success,
      };
    }

    if (AAEncodeDeobfuscator.detect(code)) {
      logger.info(': AAEncode');
      const decoded = await this.aaencodeDeobfuscator.deobfuscate(code);
      return {
        code: decoded,
        type: 'AAEncode',
        success: decoded !== code,
      };
    }

    if (URLEncodeDeobfuscator.detect(code)) {
      logger.info(': URLEncode');
      const decoded = await this.urlencodeDeobfuscator.deobfuscate(code);
      return {
        code: decoded,
        type: 'URLEncode',
        success: decoded !== code,
      };
    }

    logger.info('');
    return {
      code,
      type: 'Unknown',
      success: false,
    };
  }
}
