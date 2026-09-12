import fs from 'fs';
import path from 'path';

export interface ProjectSourceFile {
  relativePath: string;
  category: 'ui_and_chart_components' | 'data_engine_and_apis' | 'smc_quant_algorithms' | 'risk_management_and_signals' | 'config_and_server_files';
  categoryAr: string;
  fileName: string;
  extension: string;
  sizeBytes: number;
  linesCount: number;
  content: string;
}

export interface ProjectSourceBundle {
  projectName: string;
  version: string;
  generatedAt: string;
  totalFiles: number;
  totalLines: number;
  totalSizeBytes: number;
  descriptionAr: string;
  categories: {
    id: string;
    nameAr: string;
    descriptionAr: string;
    filesCount: number;
    linesCount: number;
  }[];
  files: ProjectSourceFile[];
}

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.cache',
  '.npm',
  'build',
  '.temp',
  '.vscode'
]);

const IGNORED_FILES = new Set([
  'package-lock.json',
  'xauusd-smc-quant-full-project.zip',
  'project_source_code.json'
]);

function categorizeFile(relPath: string): {
  category: ProjectSourceFile['category'];
  categoryAr: string;
} {
  const norm = relPath.replace(/\\/g, '/');

  // 1. UI & Chart Components
  if (
    norm.startsWith('src/components/') ||
    norm === 'src/App.tsx' ||
    norm === 'src/main.tsx' ||
    norm === 'src/index.css'
  ) {
    return {
      category: 'ui_and_chart_components',
      categoryAr: 'مكونات الواجهة والشارت (UI & Chart Components)',
    };
  }

  // 3. SMC Quant Algorithms
  if (
    norm.includes('smcQuantService') ||
    norm.includes('multiTimeframeEngine') ||
    norm.includes('smcEngine') ||
    norm.includes('multiTimeframeService') ||
    norm.includes('compressionWick') ||
    norm.includes('postNewsSweep') ||
    norm.includes('proximityScanner') ||
    norm.includes('mlService')
  ) {
    return {
      category: 'smc_quant_algorithms',
      categoryAr: 'منطق خوارزميات SMC والأموال الذكية (SMC Quant Algorithms)',
    };
  }

  // 4. Risk Management & Signals Engine
  if (
    norm.includes('safeguard') ||
    norm.includes('signalStore') ||
    norm.includes('automationScheduler') ||
    norm.includes('telegram') ||
    norm.includes('postTradeJournal') ||
    norm.includes('firestore')
  ) {
    return {
      category: 'risk_management_and_signals',
      categoryAr: 'محرك إدارة المخاطر والأمان والتوصيات (Risk Management & Signals)',
    };
  }

  // 2. Data Engine & APIs
  if (
    norm.startsWith('server/pricingService') ||
    norm.startsWith('server/cloudHttpGoldEngine') ||
    norm.startsWith('server/priceVolumeEngine') ||
    norm.startsWith('server/candlesService') ||
    norm.startsWith('src/services/goldApiService') ||
    norm.startsWith('src/services/futuresService') ||
    norm.startsWith('src/services/orderFlowVolume') ||
    norm.startsWith('src/services/candlesService') ||
    norm.startsWith('src/services/newsService') ||
    norm.startsWith('src/services/')
  ) {
    return {
      category: 'data_engine_and_apis',
      categoryAr: 'محرك جلب البيانات والأسعار الفورية (Data Engine & APIs)',
    };
  }

  // 5. Config & Server Files
  return {
    category: 'config_and_server_files',
    categoryAr: 'ملفات التهيئة وتكوين الخادم (Config & Server Files)',
  };
}

function scanDirectory(currentDir: string, rootDir: string, collectedFiles: ProjectSourceFile[]) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        scanDirectory(fullPath, rootDir, collectedFiles);
      }
    } else if (entry.isFile()) {
      if (IGNORED_FILES.has(entry.name) || entry.name.endsWith('.zip')) {
        continue;
      }

      // Check allowed extensions
      const ext = path.extname(entry.name).toLowerCase();
      const validExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.md', '.env', '.example', '.sql', '.rules']);
      if (!validExts.has(ext) && !entry.name.startsWith('.env')) {
        continue;
      }

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n').length;
        const sizeBytes = Buffer.byteLength(content, 'utf8');
        const catInfo = categorizeFile(relPath);

        collectedFiles.push({
          relativePath: relPath,
          category: catInfo.category,
          categoryAr: catInfo.categoryAr,
          fileName: entry.name,
          extension: ext || 'none',
          sizeBytes,
          linesCount: lines,
          content,
        });
      } catch (err) {
        console.warn(`[ProjectBundle] Could not read file ${relPath}:`, err);
      }
    }
  }
}

let cachedBundle: ProjectSourceBundle | null = null;
let lastGeneratedTime = 0;

export function buildProjectSourceBundle(forceRefresh = false): ProjectSourceBundle {
  const now = Date.now();
  if (!forceRefresh && cachedBundle && now - lastGeneratedTime < 30000) {
    return cachedBundle;
  }

  const rootDir = process.cwd();
  const collectedFiles: ProjectSourceFile[] = [];

  scanDirectory(rootDir, rootDir, collectedFiles);

  // Sort files logically: config first, then server, services, components
  collectedFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  let totalLines = 0;
  let totalSizeBytes = 0;

  const categoryStats: Record<string, { filesCount: number; linesCount: number }> = {
    ui_and_chart_components: { filesCount: 0, linesCount: 0 },
    data_engine_and_apis: { filesCount: 0, linesCount: 0 },
    smc_quant_algorithms: { filesCount: 0, linesCount: 0 },
    risk_management_and_signals: { filesCount: 0, linesCount: 0 },
    config_and_server_files: { filesCount: 0, linesCount: 0 },
  };

  for (const f of collectedFiles) {
    totalLines += f.linesCount;
    totalSizeBytes += f.sizeBytes;
    if (categoryStats[f.category]) {
      categoryStats[f.category].filesCount += 1;
      categoryStats[f.category].linesCount += f.linesCount;
    }
  }

  const bundle: ProjectSourceBundle = {
    projectName: 'XAUUSD SMC Quant Platform',
    version: '2.5.0',
    generatedAt: new Date().toISOString(),
    totalFiles: collectedFiles.length,
    totalLines,
    totalSizeBytes,
    descriptionAr: 'كافة ملفات الكود المصدري لمنصة تداول الذهب المؤسساتية (XAUUSD SMC Quant) بالكامل ودون أي اختصار، مصنفة حسب الأقسام الخمسة المطلوبة.',
    categories: [
      {
        id: 'ui_and_chart_components',
        nameAr: '1. كافة مكونات الواجهة والشارت (UI & Chart Components)',
        descriptionAr: 'واجهات React 18، شارت الشموع الزمني، بطاقات SMC، النوافذ والمحاكاة التفاعلية.',
        filesCount: categoryStats['ui_and_chart_components'].filesCount,
        linesCount: categoryStats['ui_and_chart_components'].linesCount,
      },
      {
        id: 'data_engine_and_apis',
        nameAr: '2. ملفات محرك جلب البيانات والأسعار (Data Engine & APIs)',
        descriptionAr: 'محرك تسعير الذهب الفوري Spot XAU/USD، عقود كومكس GC، تدفق الأحجام والدلتا، ومزامنة السحابة.',
        filesCount: categoryStats['data_engine_and_apis'].filesCount,
        linesCount: categoryStats['data_engine_and_apis'].linesCount,
      },
      {
        id: 'smc_quant_algorithms',
        nameAr: '3. منطق خوارزميات SMC (Order Blocks, FVG, BOS, CHoCH)',
        descriptionAr: 'حساب كتل الأوامر، فجوات القيمة العادلة، كسر الهيكل، ونظام التحليل متعدد الفريمات الـ 5 (1W/1D/4H/1H/15M).',
        filesCount: categoryStats['smc_quant_algorithms'].filesCount,
        linesCount: categoryStats['smc_quant_algorithms'].linesCount,
      },
      {
        id: 'risk_management_and_signals',
        nameAr: '4. محرك إدارة المخاطر والتوصيات (Risk Management & Signals)',
        descriptionAr: 'قاطع الدوائر الذكي، محدد الطلبات، قاطع الطوارئ Kill-Switch، وقاعدة R:R ≥ 1:2.0 ومجدول 15m وتيليجرام.',
        filesCount: categoryStats['risk_management_and_signals'].filesCount,
        linesCount: categoryStats['risk_management_and_signals'].linesCount,
      },
      {
        id: 'config_and_server_files',
        nameAr: '5. ملفات التهيئة وتكوين الخادم (Config & Server Files)',
        descriptionAr: 'ملف الخادم server.ts، حزم package.json، إعدادات Vite، والقوالب الأساسية.',
        filesCount: categoryStats['config_and_server_files'].filesCount,
        linesCount: categoryStats['config_and_server_files'].linesCount,
      },
    ],
    files: collectedFiles,
  };

  cachedBundle = bundle;
  lastGeneratedTime = now;

  // Save to public directory for direct static serving if possible
  try {
    const publicDir = path.join(rootDir, 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    fs.writeFileSync(path.join(publicDir, 'project_source_code.json'), JSON.stringify(bundle, null, 2), 'utf8');

    // Generate comprehensive single file Markdown & TXT
    const mdContent = generateSingleFileMarkdown(bundle);
    fs.writeFileSync(path.join(publicDir, 'xauusd_smc_quant_full_codebase.md'), mdContent, 'utf8');
    fs.writeFileSync(path.join(publicDir, 'xauusd_smc_quant_full_codebase.txt'), mdContent, 'utf8');

    // Also write individual category markdown files for easy incremental review
    bundle.categories.forEach((cat, idx) => {
      const catMd = generateCategoryMarkdown(bundle, cat.id);
      const catFileName = `category_${idx + 1}_${cat.id}.md`;
      fs.writeFileSync(path.join(publicDir, catFileName), catMd, 'utf8');
    });
  } catch (err) {
    console.warn('[ProjectBundle] Could not write codebase files to public:', err);
  }

  return bundle;
}

/**
 * Generate Markdown for a specific category only
 */
export function generateCategoryMarkdown(bundle: ProjectSourceBundle, categoryId: string): string {
  const cat = bundle.categories.find(c => c.id === categoryId);
  const catFiles = bundle.files.filter(f => f.category === categoryId);
  const lines: string[] = [];

  lines.push(`# XAUUSD SMC Quant Platform - ${cat ? cat.nameAr : categoryId}`);
  lines.push(`> ${cat ? cat.descriptionAr : ''}`);
  lines.push(`- إجمالي الملفات: ${catFiles.length} | إجمالي الأسطر: ${catFiles.reduce((acc, f) => acc + f.linesCount, 0)}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  catFiles.forEach((file, index) => {
    const ext = file.extension.replace('.', '');
    let lang = 'typescript';
    if (ext === 'tsx' || ext === 'jsx') lang = 'tsx';
    else if (ext === 'ts' || ext === 'js') lang = 'typescript';
    else if (ext === 'json') lang = 'json';
    else if (ext === 'css') lang = 'css';
    else if (ext === 'html') lang = 'html';
    else if (ext === 'md') lang = 'markdown';
    else if (ext === 'env' || ext === 'example') lang = 'bash';
    else if (ext === 'sql') lang = 'sql';
    else if (ext === 'rules') lang = 'javascript';

    lines.push(`================================================================================`);
    lines.push(`### [ملف ${index + 1} من ${catFiles.length}]: ${file.relativePath}`);
    lines.push(`- عدد الأسطر: ${file.linesCount} | الحجم: ${(file.sizeBytes / 1024).toFixed(2)} KB`);
    lines.push(`================================================================================`);
    lines.push('');
    lines.push('```' + lang);
    lines.push(file.content);
    lines.push('```');
    lines.push('');
    lines.push('');
  });

  return lines.join('\n');
}

export function getPublicSourceJsonPath(): string {
  return path.join(process.cwd(), 'public', 'project_source_code.json');
}

export function getPublicSourceMarkdownPath(): string {
  return path.join(process.cwd(), 'public', 'xauusd_smc_quant_full_codebase.md');
}

export function getPublicSourceTextPath(): string {
  return path.join(process.cwd(), 'public', 'xauusd_smc_quant_full_codebase.txt');
}

/**
 * Generates a unified, formatted Markdown file containing ALL source code files
 * with complete architecture documentation and metadata for an expert code reviewer / auditor.
 */
export function generateSingleFileMarkdown(bundle: ProjectSourceBundle): string {
  const lines: string[] = [];

  lines.push('# XAUUSD SMC Quant Platform - الملف الشامل لكامل الأكواد المصدرية');
  lines.push('# Complete Project Codebase Bundle for Expert Analysis, Debugging & Audit');
  lines.push('');
  lines.push('> **مخصص لخبير التطوير والتحليل الكمي والبرمجي لتشخيص الأخطاء وتصحيحها ومراجعة المعمارية.**');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 📋 بيانات وتفاصيل حزمة الكود الشاملة (Bundle Metadata)');
  lines.push(`- **اسم المشروع:** ${bundle.projectName}`);
  lines.push(`- **الإصدار الحالي:** ${bundle.version}`);
  lines.push(`- **تاريخ وتوقيت الاستخراج:** ${bundle.generatedAt}`);
  lines.push(`- **إجمالي عدد الملفات المصدرية:** ${bundle.totalFiles} ملفاً كاملاً`);
  lines.push(`- **إجمالي عدد أسطر البرمجة:** ${bundle.totalLines.toLocaleString('en-US')} سطر كود`);
  lines.push(`- **الحجم التقديري للبيانات:** ${(bundle.totalSizeBytes / 1024).toFixed(1)} كيلوبايت`);
  lines.push(`- **طبيعة الملف:** ملف واحد متكامل يحتوي على النص الكامل لجميع ملفات المشروع دون أي اجتزاء أو اختصار.`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 🏛️ ملخص المعمارية المؤسساتية والمفاهيم المالية المعتمدة (Architectural & SMC Directives)');
  lines.push('1. **بيانات الذهب الفوري وعقود كومكس COMEX GC:**');
  lines.push('   - جلب أسعار Spot XAU/USD الفورية عبر Gate.io Spot API و Pax Gold.');
  lines.push('   - تدفق أحجام عقود الذهب الآجلة الحقيقية من بورصة شيكاغو (COMEX GC Futures) مع حساب دلتا الأوامر التراكمية (CVD Delta) ونسبة عدم توازن الأوامر (Imbalance Ratio).');
  lines.push('2. **محرك SMC متعدد الأطر الزمنية (5 Timeframes):**');
  lines.push('   - فريمات: الأسبوعي (1W)، اليومي (1D)، الأربع ساعات (4H)، الساعة (1H)، والـ 15 دقيقة (15M).');
  lines.push('   - كشف كتل الأوامر (Order Blocks - OB)، فجوات القيمة العادلة (Fair Value Gaps - FVG)، وسحب السيولة (BSL / SSL).');
  lines.push('   - قياس مؤشر نضارة المناطق (Zone Freshness Index) للأولوية للمناطق غير الملموسة (Unmitigated).');
  lines.push('3. **سحب سيولة ما بعد الأخبار (Post-News Sweep):**');
  lines.push('   - قاعدة الـ 15 دقيقة بعد الأخبار الاقتصادية الكبرى (CPI, NFP) لمنع مصائد التحرك الأولي.');
  lines.push('4. **فلتر انضغاط السعر وحماية الذيول (Compression & Wick Protection):**');
  lines.push('   - كشف زنبرك السعر (Spring Coil) ووضع وقف الخسارة بناءً على أقصى ذيل + (1.5 × ATR).');
  lines.push('   - رفض أي إشارة لا تحقق نسبة عائد إلى مخاطرة R:R ≥ 1:2.0.');
  lines.push('5. **منظومة الأمان والتحوط:**');
  lines.push('   - قاطع الدوائر الذكي (AI Circuit Breaker) للتحويل التلقائي لمحرك SMC الخوارزمي عند انقطاع Gemini.');
  lines.push('   - قاطع التداول الطارئ (Emergency Kill-Switch) لإيقاف الإشارات فوراً عند الاضطرابات.');
  lines.push('   - محدد معدل الطلبات (Rate Limiter) لحماية خادم Express وواجهات التيليجرام.');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 📑 فهرس الملفات المصدرية المضمنة (Table of Contents)');
  lines.push('');
  
  bundle.categories.forEach((cat) => {
    lines.push(`### ${cat.nameAr}`);
    lines.push(`_${cat.descriptionAr}_ (عدد الملفات: ${cat.filesCount} • الأسطر: ${cat.linesCount.toLocaleString('en-US')})`);
    lines.push('');
    const catFiles = bundle.files.filter((f) => f.category === cat.id);
    catFiles.forEach((f) => {
      lines.push(`- \`${f.relativePath}\` — (${f.linesCount} سطر • ${(f.sizeBytes / 1024).toFixed(1)} KB)`);
    });
    lines.push('');
  });

  lines.push('---');
  lines.push('');
  lines.push('## 💻 الشيفرات المصدرية الكاملة لكافة الملفات (Full Source Codes)');
  lines.push('');

  bundle.files.forEach((file, index) => {
    const ext = file.extension.replace('.', '');
    let lang = 'typescript';
    if (ext === 'tsx' || ext === 'jsx') lang = 'tsx';
    else if (ext === 'ts' || ext === 'js') lang = 'typescript';
    else if (ext === 'json') lang = 'json';
    else if (ext === 'css') lang = 'css';
    else if (ext === 'html') lang = 'html';
    else if (ext === 'md') lang = 'markdown';
    else if (ext === 'env' || ext === 'example') lang = 'bash';
    else if (ext === 'sql') lang = 'sql';
    else if (ext === 'rules') lang = 'javascript';

    lines.push(`================================================================================`);
    lines.push(`### [ملف ${index + 1} من ${bundle.totalFiles}]: ${file.relativePath}`);
    lines.push(`- **التصنيف:** ${file.categoryAr}`);
    lines.push(`- **عدد الأسطر:** ${file.linesCount}`);
    lines.push(`- **الحجم:** ${(file.sizeBytes / 1024).toFixed(2)} KB`);
    lines.push(`================================================================================`);
    lines.push('');
    lines.push('```' + lang);
    lines.push(file.content);
    lines.push('```');
    lines.push('');
    lines.push('');
  });

  lines.push('---');
  lines.push('## نهاية الملف الشامل • End of Full Codebase Bundle');

  return lines.join('\n');
}
