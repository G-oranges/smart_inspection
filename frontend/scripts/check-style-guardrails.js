import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const APP_CSS = 'frontend/src/App.css';
const TOKENS_FILE = 'frontend/src/styles/base/tokens.css';
const STYLES_DIR = 'frontend/src/styles/';
const COMPONENTS_DIR = 'frontend/src/styles/components/';
const STYLES_INDEX = 'frontend/src/styles/index.css';

function runGit(args, allowFail = false) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFail) {
      return '';
    }
    const stderr = error.stderr?.toString().trim();
    throw new Error(stderr || `git ${args.join(' ')} failed`);
  }
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function splitLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(normalizePath);
}

function refExists(ref) {
  const output = runGit(['rev-parse', '--verify', '--quiet', ref], true);
  return Boolean(output);
}

function getBaseRef() {
  const envBase = process.env.STYLE_GUARD_BASE_REF?.trim();
  const githubBase = process.env.GITHUB_BASE_REF?.trim();
  const candidates = [];

  if (envBase) {
    candidates.push(envBase);
    if (!envBase.includes('/')) {
      candidates.push(`origin/${envBase}`);
    }
  }

  if (githubBase) {
    candidates.push(githubBase);
    if (!githubBase.includes('/')) {
      candidates.push(`origin/${githubBase}`);
    }
  }

  candidates.push('origin/HEAD');

  const deduped = [...new Set(candidates)];
  const resolved = deduped.find((candidate) => refExists(candidate));

  if (!resolved) {
    throw new Error(
      `无法解析基线分支。请设置 STYLE_GUARD_BASE_REF，或确保 origin/HEAD 可用。候选值: ${deduped.join(', ')}`
    );
  }

  return resolved;
}

function getTrackedChangedFiles(mergeBase) {
  const output = runGit(['diff', '--name-only', '--diff-filter=ACMRTUXB', mergeBase], true);
  return splitLines(output);
}

function getWorkingTreeChangedFiles() {
  const unstaged = splitLines(
    runGit(['diff', '--name-only', '--diff-filter=ACMRTUXB'], true)
  );
  const staged = splitLines(
    runGit(['diff', '--name-only', '--cached', '--diff-filter=ACMRTUXB'], true)
  );
  return [...new Set([...unstaged, ...staged])];
}

function getUntrackedFiles() {
  const output = runGit(['ls-files', '--others', '--exclude-standard'], true);
  return splitLines(output);
}

function isStyleFile(filePath) {
  return filePath.startsWith(STYLES_DIR) && filePath.endsWith('.css');
}

function isComponentsStyleFile(filePath) {
  return filePath.startsWith(COMPONENTS_DIR) && filePath.endsWith('.css');
}

function parseAddedLinesFromDiff(diffText) {
  const added = [];
  let currentNewLine = 0;

  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)(?:,\d+)?/);
      if (match) {
        currentNewLine = Number(match[1]);
      }
      continue;
    }

    if (line.startsWith('+++') || line.startsWith('---')) {
      continue;
    }

    if (line.startsWith('+')) {
      added.push({ lineNumber: currentNewLine, content: line.slice(1) });
      currentNewLine += 1;
      continue;
    }

    if (line.startsWith(' ')) {
      currentNewLine += 1;
    }
  }

  return added;
}

function parseAddedLinesFromFile(filePath) {
  const absPath = path.resolve(repoRoot, filePath);
  if (!fs.existsSync(absPath)) {
    return [];
  }

  return fs
    .readFileSync(absPath, 'utf8')
    .split(/\r?\n/)
    .map((content, index) => ({ lineNumber: index + 1, content }));
}

function inspectStyleLines(filePath, addedLines) {
  const violations = [];
  const oldTokenRegex = /--color-[a-z0-9-]+/i;
  const hexColorRegex = /(?:^|[:\s,(])#[0-9a-fA-F]{3,8}\b/;
  const colorFunctionRegex = /\b(?:rgb|rgba|hsl|hsla)\s*\(/i;

  for (const line of addedLines) {
    const text = line.content;
    if (!text.trim()) {
      continue;
    }

    if (oldTokenRegex.test(text)) {
      violations.push({
        file: filePath,
        line: line.lineNumber,
        rule: '禁止使用旧变量 --color-*',
        content: text.trim(),
      });
    }

    if (hexColorRegex.test(text) || colorFunctionRegex.test(text)) {
      violations.push({
        file: filePath,
        line: line.lineNumber,
        rule: '禁止硬编码颜色（请改用 var(--co-*)）',
        content: text.trim(),
      });
    }
  }

  return violations;
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkComponentImports(componentFiles) {
  const violations = [];
  const indexPath = path.resolve(repoRoot, STYLES_INDEX);
  const indexContent = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';

  for (const filePath of componentFiles) {
    const fileName = path.basename(filePath);
    const importRegex = new RegExp(
      `@import\\s+['"]\\./components/${escapeRegExp(fileName)}['"]\\s*;`
    );

    if (!importRegex.test(indexContent)) {
      violations.push({
        file: STYLES_INDEX,
        line: '-',
        rule: `缺少组件样式导入: ${fileName}`,
        content: `请在 ${STYLES_INDEX} 添加 @import './components/${fileName}';`,
      });
    }
  }

  return violations;
}

function printViolationsAndExit(baseRef, mergeBase, violations) {
  console.error('\n❌ 样式护栏检查失败');
  console.error(`基线引用: ${baseRef}`);
  console.error(`merge-base: ${mergeBase}`);
  console.error('\n违规详情:');

  for (const item of violations) {
    console.error(`- ${item.file}:${item.line} | ${item.rule}`);
    console.error(`  ${item.content}`);
  }

  console.error('\n修复建议:');
  console.error(`1. 所有颜色统一改为 var(--co-*)，禁止新增 --color-*、#hex、rgb()/hsl()。`);
  console.error(`2. 新增页面样式写入 ${COMPONENTS_DIR}，并在 ${STYLES_INDEX} 中 @import。`);
  console.error(`3. 禁止修改 ${APP_CSS}。`);
  process.exit(1);
}

function main() {
  const baseRef = getBaseRef();
  const mergeBase = runGit(['merge-base', baseRef, 'HEAD']);
  const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  const trackedChangedFiles = isCi
    ? getTrackedChangedFiles(mergeBase)
    : getWorkingTreeChangedFiles();
  const untrackedFiles = getUntrackedFiles();
  const allChangedFiles = [...new Set([...trackedChangedFiles, ...untrackedFiles])];

  const violations = [];

  if (allChangedFiles.includes(APP_CSS)) {
    violations.push({
      file: APP_CSS,
      line: '-',
      rule: '禁止修改 frontend/src/App.css',
      content: '请将新增样式迁移到 frontend/src/styles/components/*.css',
    });
  }

  const styleFiles = allChangedFiles.filter(
    (filePath) => isStyleFile(filePath) && filePath !== TOKENS_FILE
  );

  for (const filePath of styleFiles) {
    const inUntrackedSet = untrackedFiles.includes(filePath);
    const diffBase = isCi ? mergeBase : 'HEAD';
    const addedLines = inUntrackedSet
      ? parseAddedLinesFromFile(filePath)
      : parseAddedLinesFromDiff(
          runGit(['diff', '--unified=0', '--no-color', diffBase, '--', filePath], true)
        );
    violations.push(...inspectStyleLines(filePath, addedLines));
  }

  const componentStyleFiles = allChangedFiles.filter(isComponentsStyleFile);
  violations.push(...checkComponentImports(componentStyleFiles));

  if (violations.length > 0) {
    printViolationsAndExit(baseRef, mergeBase, violations);
  }

  console.log('\n✅ 样式护栏检查通过');
  console.log(`模式: ${isCi ? 'CI (merge-base 对比)' : 'Local (working tree 对比)'}`);
  console.log(`基线引用: ${baseRef}`);
  console.log(`merge-base: ${mergeBase}`);
  console.log(`已检查文件: ${allChangedFiles.length}（样式文件 ${styleFiles.length}）`);
}

main();
