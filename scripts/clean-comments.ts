import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const files = [
  'src/modules/analyzer/AISummarizer.ts',
  'src/modules/analyzer/CodeAnalyzer.ts',
  'src/modules/analyzer/IntelligentAnalyzer.ts',
  'src/modules/browser/BrowserModeManager.ts',
  'src/modules/captcha/AICaptchaDetector.ts',
  'src/modules/captcha/CaptchaDetector.ts',
  'src/modules/collector/CodeCache.ts',
  'src/modules/collector/CodeCollector.ts',
  'src/modules/collector/CodeCompressor.ts',
  'src/modules/collector/DOMInspector.ts',
  'src/modules/collector/PageController.ts',
  'src/modules/collector/SmartCodeCollector.ts',
  'src/modules/collector/StreamingCollector.ts',
  'src/modules/crypto/CryptoRules.ts',
  'src/modules/debugger/BlackboxManager.ts',
  'src/modules/debugger/DebuggerManager.ts',
  'src/modules/debugger/EventBreakpointManager.ts',
  'src/modules/debugger/RuntimeInspector.ts',
  'src/modules/debugger/ScriptManager.ts',
  'src/modules/debugger/WatchExpressionManager.ts',
  'src/modules/debugger/XHRBreakpointManager.ts',
  'src/modules/deobfuscator/AdvancedDeobfuscator.ts',
  'src/modules/deobfuscator/ASTOptimizer.ts',
  'src/modules/deobfuscator/Deobfuscator.ts',
  'src/modules/deobfuscator/JScramberDeobfuscator.ts',
  'src/modules/deobfuscator/JSVMPDeobfuscator.ts',
  'src/modules/deobfuscator/PackerDeobfuscator.ts',
  'src/modules/detector/ObfuscationDetector.ts',
  'src/modules/emulator/AIEnvironmentAnalyzer.ts',
  'src/modules/emulator/BrowserAPIDatabase.ts',
  'src/modules/emulator/BrowserEnvironmentRules.ts',
  'src/modules/emulator/EnvironmentEmulator.ts',
  'src/modules/emulator/templates/chrome-env.ts',
  'src/modules/hook/AIHookGenerator.ts',
  'src/modules/hook/HookManager.ts',
  'src/modules/monitor/ConsoleMonitor.ts',
  'src/modules/monitor/PerformanceMonitor.ts',
  'src/modules/stealth/StealthScripts.ts',
  'src/modules/symbolic/JSVMPSymbolicExecutor.ts',
  'src/modules/symbolic/SymbolicExecutor.ts',
  'src/server/AdvancedToolDefinitions.ts',
  'src/server/AdvancedToolHandlers.ts',
  'src/server/AIHookToolDefinitions.ts',
  'src/server/AIHookToolHandlers.ts',
  'src/server/BrowserToolDefinitions.ts',
  'src/server/BrowserToolHandlers.ts',
  'src/server/CacheToolDefinitions.ts',
  'src/server/DebuggerToolDefinitions.ts',
  'src/server/DebuggerToolHandlers.ts',
  'src/server/HookPresetToolDefinitions.ts',
  'src/server/HookPresetToolHandlers.ts',
  'src/server/TokenBudgetToolDefinitions.ts',
  'src/utils/AdaptiveDataSerializer.ts',
  'src/utils/CacheAdapters.ts',
  'src/utils/detailedDataManager.ts',
  'src/utils/parallel.ts',
  'src/utils/TokenBudgetManager.ts',
  'src/utils/UnifiedCacheManager.ts',
];

const CHINESE_RE = /[\u4e00-\u9fff\u3400-\u4dbf\u20000-\u2a6df]/;
const EMOJI_RE = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu;

function hasChineseOrEmoji(s: string): boolean {
  return CHINESE_RE.test(s) || EMOJI_RE.test(s);
}

function cleanLine(line: string): string | null {
  // Remove lines that are pure single-line comment with Chinese/emoji
  // e.g. "  // 这是注释" or "  * 中文"
  if (/^\s*\/\//.test(line) && hasChineseOrEmoji(line)) {
    return null; // drop line
  }
  // Remove lines that are JSDoc description lines (* Chinese)
  if (/^\s*\*\s/.test(line) && !line.includes('@') && hasChineseOrEmoji(line)) {
    return null;
  }
  // Remove lines that are JSDoc start lines with only Chinese description
  if (/^\s*\/\*\*/.test(line) && hasChineseOrEmoji(line) && !line.includes('*/')) {
    return null;
  }
  // Remove empty JSDoc blocks that start+end on same line with Chinese
  if (/^\s*\/\*\*.*[\u4e00-\u9fff].*\*\//.test(line)) {
    return null;
  }

  // Strip inline comment at end of code line
  // e.g.: "const x = 1; // 这里赋值"
  const inlineCommentIdx = line.indexOf('//');
  if (inlineCommentIdx > 0) {
    const commentPart = line.substring(inlineCommentIdx);
    if (hasChineseOrEmoji(commentPart)) {
      line = line.substring(0, inlineCommentIdx).trimEnd();
    }
  }

  // Strip emojis from anywhere in the line (e.g. logger.info('🖼️...'))
  EMOJI_RE.lastIndex = 0;
  if (EMOJI_RE.test(line)) {
    EMOJI_RE.lastIndex = 0;
    line = line.replace(EMOJI_RE, '');
  }

  // Clean up lines that now only have string punctuation residue after emoji removal
  // e.g. logger.info(' 读取图片文件: ') -> keep line but remove Chinese chars from strings
  if (CHINESE_RE.test(line)) {
    // Replace Chinese characters in string literals with empty
    line = line.replace(/[\u4e00-\u9fff\u3400-\u4dbf]+/g, '');
  }

  return line;
}

function processFile(filePath: string): void {
  const content = readFileSync(filePath, 'utf-8');
  if (!hasChineseOrEmoji(content)) return;

  const lines = content.split('\n');
  const result: string[] = [];
  let inDocBlock = false;
  let skipBlock = false;
  let blockHasChinese = false;
  let blockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Detect start of multi-line comment block
    if (!inDocBlock && /^\s*\/\*[\*!]?/.test(line)) {
      inDocBlock = true;
      skipBlock = false;
      blockHasChinese = hasChineseOrEmoji(line);
      blockLines = [line];

      if (line.includes('*/')) {
        // Single line block comment
        inDocBlock = false;
        if (blockHasChinese && !line.includes('@')) {
          // Skip this entirely
        } else {
          result.push(line);
        }
        blockLines = [];
      }
      continue;
    }

    if (inDocBlock) {
      if (hasChineseOrEmoji(line)) blockHasChinese = true;
      blockLines.push(line);

      if (line.includes('*/')) {
        inDocBlock = false;
        // Check if the entire block is Chinese-only
        const nonCommentContent = blockLines
          .map(l => l.replace(/^\s*[\/*]/g, '').trim())
          .filter(l => l && !l.startsWith('*') && !l.startsWith('/'));

        const hasMeaningfulEnglish = blockLines.some(l => {
          const stripped = l.replace(/^\s*[\/*]+\s*/g, '').trim();
          return stripped.length > 3 && !CHINESE_RE.test(stripped) && stripped !== '*' && !stripped.startsWith('@param') && !stripped.startsWith('@returns');
        });

        if (blockHasChinese && !hasMeaningfulEnglish) {
          // Drop entire block
        } else {
          // Keep block but clean individual lines
          for (const bl of blockLines) {
            const cleaned = cleanLine(bl);
            if (cleaned !== null) result.push(cleaned);
          }
        }
        blockLines = [];
        blockHasChinese = false;
      }
      continue;
    }

    const cleaned = cleanLine(line);
    if (cleaned !== null) result.push(cleaned);
  }

  // Remove trailing empty lines created by removed comment blocks
  while (result.length > 1 && result[result.length - 1]?.trim() === '' && result[result.length - 2]?.trim() === '') {
    result.pop();
  }

  writeFileSync(filePath, result.join('\n'), 'utf-8');
  console.log(`Cleaned: ${filePath}`);
}

const root = process.cwd();
for (const f of files) {
  try {
    processFile(join(root, f));
  } catch (e) {
    console.error(`Failed to process ${f}:`, e);
  }
}

console.log('Done!');
