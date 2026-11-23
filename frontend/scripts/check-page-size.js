/**
 * 页面文件行数检查脚本
 * 用于 CI 或本地检查 pages 目录（递归，含 .ts/.tsx/.js/.jsx，跳过测试文件）的文件行数
 * 
 * 使用方式: npm run lint:pagesize
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 解析 pages 目录路径
 * 优先：__dirname 相对路径（推荐，脚本位于 frontend/scripts 时）
 * Fallback：process.cwd() 相对路径（支持从项目根目录运行）
 */
function resolvePagesDir() {
  // 优先路径：脚本所在位置的上一级 src/pages
  const primaryPath = path.join(__dirname, '../src/pages');
  if (fs.existsSync(primaryPath)) {
    return primaryPath;
  }
  
  // Fallback 路径：当前工作目录的 src/pages
  const fallbackPath = path.join(process.cwd(), 'src', 'pages');
  if (fs.existsSync(fallbackPath)) {
    console.log(`⚠️ 使用 fallback 路径: ${fallbackPath}`);
    return fallbackPath;
  }
  
  // 都找不到，报错退出
  console.error('❌ 错误：无法找到 pages 目录');
  console.error(`   尝试路径 1: ${primaryPath}`);
  console.error(`   尝试路径 2: ${fallbackPath}`);
  console.error('   请确保在正确的目录下运行此脚本，或检查 src/pages 目录是否存在。');
  process.exit(1);
}

// 配置
const CONFIG = {
  pagesDir: resolvePagesDir(),
  maxLines: 3000,      // 临时过渡期阈值（超过此值阻断 CI）
  targetLines: 1000,   // 目标阈值
  warnLines: 2000,     // 警告阈值
};

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').length;
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function isTestFile(name) {
  return /\.(test|spec)\.[jt]sx?$/.test(name);
}

/**
 * 递归收集 pages 目录下所有源码文件（跳过 __tests__ 与 *.test/*.spec）
 */
function collectSourceFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      files.push(...collectSourceFiles(fullPath));
    } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name)) && !isTestFile(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkPageSizes() {
  const files = collectSourceFiles(CONFIG.pagesDir);

  const results = [];
  let hasError = false;
  let hasWarning = false;

  for (const filePath of files) {
    const file = path.relative(CONFIG.pagesDir, filePath).split(path.sep).join('/');
    const lines = countLines(filePath);
    const status = lines > CONFIG.maxLines ? 'ERROR' : 
                   lines > CONFIG.warnLines ? 'WARN' : 
                   lines > CONFIG.targetLines ? 'OK' : 'GOOD';
    
    results.push({ file, lines, status });
    
    if (status === 'ERROR') hasError = true;
    if (status === 'WARN') hasWarning = true;
  }

  // 按行数降序排列
  results.sort((a, b) => b.lines - a.lines);

  // 输出报告
  console.log('\n📊 Pages 文件行数检查报告\n');
  console.log('='.repeat(60));
  console.log(`${'文件'.padEnd(50)} ${'行数'.padStart(8)} ${'状态'.padStart(8)}`);
  console.log('-'.repeat(60));

  // 只列出超过目标阈值的文件，避免 100+ 个小文件刷屏
  const oversized = results.filter(r => r.status !== 'GOOD');
  for (const { file, lines, status } of oversized) {
    const statusIcon = status === 'ERROR' ? '❌' :
                       status === 'WARN' ? '⚠️' :
                       status === 'OK' ? '📝' : '✅';
    console.log(`${file.padEnd(52)} ${String(lines).padStart(8)} ${statusIcon} ${status}`);
  }

  console.log('='.repeat(60));
  console.log(`\n已扫描 ${results.length} 个文件，其中 ${oversized.length} 个超过目标阈值`);
  console.log(`配置: 目标 ${CONFIG.targetLines} 行 | 警告 ${CONFIG.warnLines} 行 | 错误 ${CONFIG.maxLines} 行`);
  
  if (hasError) {
    console.log('\n❌ 检查失败：存在超过 ' + CONFIG.maxLines + ' 行的文件\n');
    process.exit(1);
  } else if (hasWarning) {
    console.log('\n⚠️ 检查通过（有警告）：部分文件超过 ' + CONFIG.warnLines + ' 行\n');
    process.exit(0);
  } else {
    console.log('\n✅ 检查通过\n');
    process.exit(0);
  }
}

checkPageSizes();
