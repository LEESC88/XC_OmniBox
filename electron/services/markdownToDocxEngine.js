const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  TableLayoutType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  VerticalAlign,
  LineRuleType,
  LevelFormat,
  LevelSuffix,
  ExternalHyperlink,
  CheckBox,
  Header,
  Footer,
  PageNumber,
  ImageRun,
} = require('docx');

let Prism;
try {
  Prism = require('prismjs');
  const prismComponents = [
    'javascript',
    'typescript',
    'python',
    'json',
    'bash',
    'sql',
    'java',
    'c',
    'cpp',
    'csharp',
    'go',
    'rust',
    'yaml',
    'css',
    'markup',
  ];
  for (const comp of prismComponents) {
    try {
      require(`prismjs/components/prism-${comp}`);
    } catch (_) {}
  }
} catch (e) {
  console.warn('[markdownToDocxEngine] Prism load error:', e.message);
}

let createCanvasFn;
try {
  createCanvasFn = require('@napi-rs/canvas').createCanvas;
} catch (_) {}

const emojiPngCache = new Map();

/**
 * 现代 Emoji 正则（匹配标准单个、复合肤色及 ZWJ 序列）
 */
const EMOJI_INLINE_REGEX = /(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*|\p{Emoji_Presentation})/gu;

/**
 * 内存动态光栅化 Emoji 为 64x64 高清内联微图（带缓存，杜绝 Word 导出 PDF 时内嵌 4MB 系统字体）
 */
function getEmojiPngBuffer(emojiChar) {
  if (!createCanvasFn) return null;
  if (emojiPngCache.has(emojiChar)) {
    return emojiPngCache.get(emojiChar);
  }
  try {
    const canvas = createCanvasFn(64, 64);
    const ctx = canvas.getContext('2d');
    ctx.font = '48px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emojiChar, 32, 34);
    const buf = canvas.toBuffer('image/png');
    emojiPngCache.set(emojiChar, buf);
    return buf;
  } catch (_) {
    return null;
  }
}

/**
 * 将含 Emoji 的文本切分为普通文字与 Emoji 碎片
 */
function splitTextAndEmoji(text) {
  const parts = [];
  let lastIdx = 0;
  let m;
  const re = new RegExp(EMOJI_INLINE_REGEX.source, 'gu');
  while ((m = re.exec(text)) !== null) {
    const token = m[0];
    const cp = token.codePointAt(0);
    if (
      cp === 0x00A9 ||
      cp === 0x00AE ||
      cp === 0x2122 ||
      (cp >= 0x25A0 && cp <= 0x25FF && !token.includes('\uFE0F'))
    ) {
      continue;
    }
    if (m.index > lastIdx) {
      parts.push({ isEmoji: false, text: text.slice(lastIdx, m.index) });
    }
    parts.push({ isEmoji: true, text: token });
    lastIdx = m.index + token.length;
  }
  if (lastIdx < text.length) {
    parts.push({ isEmoji: false, text: text.slice(lastIdx) });
  }
  return parts;
}

// 仿真 VS Code Dark+ IDE 高保真语法色彩板（100% 还原现代编辑器视觉）
const CODE_THEME_COLORS = {
  keyword: '569CD6', // 蓝/青（private, let, const, return, if 等关键字）
  'class-name': '4EC9B0', // 青绿（类名与类型）
  builtin: '4EC9B0', // 青绿（string, null, Number, Math 等内置类型）
  type: '4EC9B0',
  function: 'DCDCAA', // 柔黄（calculatedDuration, parseInt, split 等方法）
  string: 'CE9178', // 暖橙/砖红（'Full-Time', '08:00 - 17:30' 等字符串）
  char: 'CE9178',
  number: 'B5CEA8', // 淡绿（0, 3600, 60, 8 等数值字面量）
  boolean: '569CD6',
  comment: '6A9955', // 橄榄绿（// 1. 获取班次标准上班时间... 独占注释色）
  operator: 'D4D4D4',
  punctuation: 'D4D4D4',
  property: '9CDCFE', // 浅天蓝（对象属性与参数名）
  variable: '9CDCFE',
  parameter: '9CDCFE',
  regex: 'D16969',
  tag: '569CD6',
  'attr-name': '9CDCFE',
  'attr-value': 'CE9178',
  default: 'D4D4D4', // 浅灰主正文字色
};

const LANG_ALIAS = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  cs: 'csharp',
  golang: 'go',
  rs: 'rust',
  rb: 'ruby',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  vue: 'markup',
};

function tokenizeCode(codeText, langName = '') {
  const normLang = LANG_ALIAS[String(langName || '').toLowerCase()] || String(langName || '').toLowerCase();
  const grammar = (Prism && Prism.languages[normLang]) || (Prism && Prism.languages.javascript);

  let flatTokens = [];
  if (grammar) {
    const rawTokens = Prism.tokenize(codeText || '', grammar);
    function walk(tok, inheritedType) {
      if (typeof tok === 'string') {
        flatTokens.push({ text: tok, type: inheritedType || 'default' });
      } else if (Array.isArray(tok)) {
        tok.forEach((t) => walk(t, inheritedType));
      } else if (typeof tok === 'object' && tok !== null) {
        const type = tok.type || inheritedType || 'default';
        if (typeof tok.content === 'string') {
          flatTokens.push({ text: tok.content, type });
        } else {
          walk(tok.content, type);
        }
      }
    }
    rawTokens.forEach((t) => walk(t, null));
  } else {
    flatTokens = [{ text: codeText || '', type: 'default' }];
  }

  const lines = [];
  let currentLine = [];
  for (const tok of flatTokens) {
    const parts = tok.text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        lines.push(currentLine.length > 0 ? currentLine : [{ text: ' ', type: 'default', color: 'D4D4D4' }]);
        currentLine = [];
      }
      if (parts[i]) {
        const color = CODE_THEME_COLORS[tok.type] || CODE_THEME_COLORS.default;
        const italic = tok.type === 'comment';
        currentLine.push({ text: parts[i], type: tok.type, color, italic });
      }
    }
  }
  lines.push(currentLine.length > 0 ? currentLine : [{ text: ' ', type: 'default', color: 'D4D4D4' }]);
  return lines;
}

/**
 * 常用 LaTeX 数学符号映射表，使 DeepSeek / ChatGPT 输出的行内公式在 Word 中优雅可读
 */
const LATEX_SYMBOL_MAP = [
  [/\\times\b/g, '×'],
  [/\\div\b/g, '÷'],
  [/\\pm\b/g, '±'],
  [/\\mp\b/g, '∓'],
  [/\\cdot\b/g, '·'],
  [/\\leq?\b/g, '≤'],
  [/\\geq?\b/g, '≥'],
  [/\\neq?\b/g, '≠'],
  [/\\approx\b/g, '≈'],
  [/\\equiv\b/g, '≡'],
  [/\\propto\b/g, '∝'],
  [/\\infty\b/g, '∞'],
  [/\\partial\b/g, '∂'],
  [/\\nabla\b/g, '∇'],
  [/\\forall\b/g, '∀'],
  [/\\exists\b/g, '∃'],
  [/\\in\b/g, '∈'],
  [/\\notin\b/g, '∉'],
  [/\\subset\b/g, '⊂'],
  [/\\subseteq\b/g, '⊆'],
  [/\\cup\b/g, '∪'],
  [/\\cap\b/g, '∩'],
  [/\\emptyset\b/g, '∅'],
  [/\\rightarrow\b|\\to\b/g, '→'],
  [/\\leftarrow\b/g, '←'],
  [/\\Rightarrow\b/g, '⇒'],
  [/\\Leftrightarrow\b/g, '⇔'],
  [/\\sum\b/g, '∑'],
  [/\\prod\b/g, '∏'],
  [/\\int\b/g, '∫'],
  [/\\sqrt\{([^}]+)\}/g, '√($1)'],
  [/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)'],
  [/\\alpha\b/g, 'α'],
  [/\\beta\b/g, 'β'],
  [/\\gamma\b/g, 'γ'],
  [/\\delta\b/g, 'δ'],
  [/\\epsilon\b/g, 'ε'],
  [/\\theta\b/g, 'θ'],
  [/\\lambda\b/g, 'λ'],
  [/\\mu\b/g, 'μ'],
  [/\\pi\b/g, 'π'],
  [/\\sigma\b/g, 'σ'],
  [/\\tau\b/g, 'τ'],
  [/\\phi\b/g, 'φ'],
  [/\\omega\b/g, 'ω'],
  [/\\Delta\b/g, 'Δ'],
  [/\\Sigma\b/g, 'Σ'],
  [/\\Omega\b/g, 'Ω'],
  [/\\text\{([^}]+)\}/g, '$1'],
  [/\\mathrm\{([^}]+)\}/g, '$1'],
  [/\\mathbf\{([^}]+)\}/g, '$1'],
  [/\\%/g, '%'],
];

function cleanLatexMath(expr) {
  let out = String(expr || '').trim();
  for (const [re, rep] of LATEX_SYMBOL_MAP) {
    out = out.replace(re, rep);
  }
  out = out.replace(/\{([^{}]+)\}/g, '$1');
  return out;
}

/**
 * 智能解码输入字节流（兼容 UTF-8 BOM、UTF-16LE/BE、GB18030/GBK）
 */
function decodeInputBuffer(fileBuffer) {
  if (!fileBuffer) return '';
  const buf = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
  if (buf.length === 0) return '';

  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf-8');
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buf.subarray(2));
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buf.subarray(2));
  }

  try {
    const strictUtf8 = new TextDecoder('utf-8', { fatal: true });
    return strictUtf8.decode(buf);
  } catch (_) {
    try {
      return new TextDecoder('gb18030').decode(buf);
    } catch (_e) {
      return buf.toString('utf-8');
    }
  }
}

/**
 * 预处理与规范化文本：
 * 1. 先隔离保护所有围栏代码块 (```...``` / ~~~...~~~) 与行内代码 (`...`)，绝不让 HTML/实体替换破坏代码内容
 * 2. 将网页复制粘贴带入的 HTML 表格 / 标题 / 列表无损转译为标准 Markdown 结构（同时保留 <span style="..."> 与 <br>）
 * 3. 可选清理 AI 对话首尾客套寒暄语（如“好的，以下是为您生成的...”）
 */
function normalizeInputContent(rawText, cleanAiArtifacts = true) {
  let text = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, '');

  // 1. 隔离保护围栏代码块（支持缩进围栏、3个及以上反引号或波浪号）
  const fencedShields = [];
  text = text.replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, (match) => {
    const idx = fencedShields.length;
    fencedShields.push(match);
    return `\x00FENCED_CODE_${idx}\x00`;
  });

  // 2. 隔离保护行内代码（支持单反引号与双反引号 `` `code` ``）
  const inlineShields = [];
  text = text.replace(/(`+)([^`\n]+?)\1/g, (match) => {
    const idx = inlineShields.length;
    inlineShields.push(match);
    return `\x00INLINE_CODE_${idx}\x00`;
  });

  // 3. 将 HTML <table> 转换为标准 Markdown 表格（保留 <br> 与 <span style="...">）
  if (/<table[\s>]/i.test(text)) {
    text = text.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_match, tableInner) => {
      const rows = [];
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let trMatch;
      while ((trMatch = trRegex.exec(tableInner)) !== null) {
        const cells = [];
        const cellRegex = /<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi;
        let cellMatch;
        while ((cellMatch = cellRegex.exec(trMatch[1])) !== null) {
          const cellText = cellMatch[2]
            .replace(/<br\s*\/?>/gi, '<br>')
            .replace(/<\/p>\s*<p[^>]*>/gi, '<br>')
            .replace(/<(?!\/?(?:span|br|strong|b|em|i|mark|code|sub|sup)\b)[^>]+>/gi, '')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/\s*\n\s*/g, ' ')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();
          cells.push(cellText);
        }
        if (cells.length > 0) rows.push(cells);
      }
      if (rows.length === 0) return '';
      const maxCols = Math.max(...rows.map((r) => r.length));
      const padRow = (r) => {
        const copy = [...r];
        while (copy.length < maxCols) copy.push('');
        return `| ${copy.map((c) => c.replace(/\|/g, '\\|')).join(' | ')} |`;
      };
      const headerLine = padRow(rows[0]);
      const sepLine = `| ${Array.from({ length: maxCols }, () => '---').join(' | ')} |`;
      const bodyLines = rows.slice(1).map(padRow);
      return `\n\n${[headerLine, sepLine, ...bodyLines].join('\n')}\n\n`;
    });
  }

  // 4. 将常见 HTML 内联格式化标签转为 Markdown（保留 <span style="..."> 与 <br> 供行内富文本解析器消费）
  text = text
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<(strong|b)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<mark(?:\s[^>]*)?>([\s\S]*?)<\/mark>/gi, '==$1==')
    .replace(/<code(?:\s[^>]*)?>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<span(?![^>]*style=)[^>]*>([\s\S]*?)<\/span>/gi, '$1');

  // 5. 逐行处理块级 HTML 标签：严禁在 Markdown 表格行（含 | 的行）中把任何标签替换成 \n，防止把表格行炸碎
  text = text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const isTableRow = trimmed.startsWith('|') || (trimmed.includes('|') && /\|.*\|/.test(trimmed));
      if (isTableRow) {
        return line
          .replace(/<\/?(?:div|p|section|article|ul|ol|li|thead|tbody)[^>]*>/gi, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/&quot;/gi, '"');
      }
      return line
        .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
        .replace(/<\/?(?:ul|ol|p|div|section|article|thead|tbody)[^>]*>/gi, '\n')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"');
    })
    .join('\n');

  // 6. 还原行内代码与围栏代码块（原封不动恢复，0 损耗）
  text = text.replace(/\x00INLINE_CODE_(\d+)\x00/g, (_m, idx) => inlineShields[Number(idx)] ?? '');
  text = text.replace(/\x00FENCED_CODE_(\d+)\x00/g, (_m, idx) => fencedShields[Number(idx)] ?? '');

  if (cleanAiArtifacts) {
    // 清理首行典型 AI 导语（仅当紧跟空行或标题/分隔线时移除，绝不误伤正文）
    const lines = text.split('\n');
    while (lines.length > 0 && !lines[0].trim()) lines.shift();
    if (lines.length >= 2) {
      const firstLine = lines[0].trim();
      const isAiPreamble =
        /^(好的|当然|没问题|以下是|这是为您|为您起草|为您整理|根据您的要求|Sure[,!]|Certainly[,!]|Here is the|Below is the)[^。\n]{0,60}[：:。!！]$/i.test(
          firstLine
        );
      if (isAiPreamble) {
        lines.shift();
        while (lines.length > 0 && !lines[0].trim()) lines.shift();
        if (lines[0] && /^---\s*$/.test(lines[0].trim())) {
          lines.shift();
        }
      }
    }
    // 清理末行典型 AI 追问寒暄
    while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop();
    if (lines.length >= 2) {
      const lastLine = lines[lines.length - 1].trim();
      const isAiPostamble =
        /^(希望以上内容|如果您需要进一步修改|如需调整|请问还有什么|Let me know if you|Hope this helps|Feel free to ask)[^#\n]{0,80}$/i.test(
          lastLine
        );
      if (isAiPostamble) {
        lines.pop();
        while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop();
        if (lines.length > 0 && /^---\s*$/.test(lines[lines.length - 1].trim())) {
          lines.pop();
        }
      }
    }
    text = lines.join('\n');
  }

  return text.trim();
}

/**
 * 解析内联 CSS style 字符串，提取文字颜色、背景底纹（自动将半透明 rgba 混合至白底以适配浅色纸张）、加粗与字号
 */
function parseCssInlineStyle(styleStr) {
  const s = String(styleStr || '');
  let colorHex = null;
  let bgHex = null;
  let isBadge = false;
  let bold = false;
  let fontSizePt = null;

  const parseColorVal = (val, isBg = false) => {
    if (!val) return null;
    const hexM = /#([0-9a-fA-F]{3,6})\b/.exec(val);
    if (hexM) {
      let h = hexM[1].toUpperCase();
      if (h.length === 3) {
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      }
      return h.slice(0, 6);
    }
    const rgbM = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i.exec(val);
    if (rgbM) {
      let r = Math.min(255, parseInt(rgbM[1], 10));
      let g = Math.min(255, parseInt(rgbM[2], 10));
      let b = Math.min(255, parseInt(rgbM[3], 10));
      const a = rgbM[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbM[4]))) : 1;
      if (isBg && a < 1) {
        const effA = Math.max(a, 0.16);
        r = Math.round(r * effA + 255 * (1 - effA));
        g = Math.round(g * effA + 255 * (1 - effA));
        b = Math.round(b * effA + 255 * (1 - effA));
      }
      return [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    return null;
  };

  const darkenBrightTextOnLightBg = (hex) => {
    if (!hex || hex.length !== 6) return hex;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (lum > 0.62) {
      return [Math.round(r * 0.58), Math.round(g * 0.58), Math.round(b * 0.58)]
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    }
    return hex;
  };

  const bgMatch = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i.exec(s);
  if (bgMatch) {
    bgHex = parseColorVal(bgMatch[1], true);
  }
  const colorMatch = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(s);
  if (colorMatch) {
    colorHex = parseColorVal(colorMatch[1], false);
    if (colorHex) colorHex = darkenBrightTextOnLightBg(colorHex);
  }
  if (/padding|border-radius|border\s*:/i.test(s) && bgHex) {
    isBadge = true;
  }
  if (/font-weight\s*:\s*(?:bold|[6-9]00)/i.test(s)) {
    bold = true;
  }
  const fsMatch = /font-size\s*:\s*(\d+(?:\.\d+)?)px/i.exec(s);
  if (fsMatch) {
    fontSizePt = Math.max(8, Math.min(18, Math.round(parseFloat(fsMatch[1]) * 0.75)));
  }

  return { colorHex, bgHex, isBadge, bold, fontSizePt };
}

/**
 * 解析行内富文本 Runs：支持 <span style="..."> 胶囊徽章/着色、双反引号代码、加粗内嵌行内代码（如 **`-`**）、粗斜体、删除线、高亮、超链接、行内数学公式与换行 <br>
 */
function parseInlineRuns(text, inheritedStyle = {}) {
  if (!text) return [];
  const raw = String(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:div|p)[^>]*>/gi, '');

  // 综合行内 Token 正则（优先级：<span style="..."> -> 双反引号代码 -> 单反引号代码 -> 粗斜体 -> 加粗 -> 斜体 -> 删除线 -> 高亮 -> 数学公式 -> 超链接）
  const tokenRegex =
    /(<span\s+[^>]*style=(["'])([\s\S]*?)\2[^>]*>([\s\S]*?)<\/span>|``([^`\n]+?)``|`([^`\n]+?)`|\*\*\*([\s\S]+?)\*\*\*|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([^*\n]+?)\*|_([^_\n]+?)_|~~([^~\n]+?)~~|==([^=\n]+?)==|\$\$([^$\n]+?)\$\$|\$([^$\n]+?)\$|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/gi;

  const runs = [];
  let lastIndex = 0;
  let match;

  const pushInherited = (r) => {
    const cleanedText =
      r.type === 'text'
        ? String(r.text || '').replace(/<\/?(?:span|div|p|font)[^>]*>/gi, '')
        : r.text;
    if (r.type === 'text' && !cleanedText) return;
    runs.push({
      ...r,
      text: cleanedText,
      bold: Boolean(r.bold || inheritedStyle.bold),
      italic: Boolean(r.italic || inheritedStyle.italic),
      strike: Boolean(r.strike || inheritedStyle.strike),
      color: r.color || inheritedStyle.color,
      highlight: r.highlight || inheritedStyle.highlight,
      isBadge: Boolean(r.isBadge || inheritedStyle.isBadge),
      fontSizePt: r.fontSizePt || inheritedStyle.fontSizePt,
    });
  };

  while ((match = tokenRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      pushInherited({ type: 'text', text: raw.slice(lastIndex, match.index) });
    }

    if (match[3] !== undefined && match[4] !== undefined) {
      // <span style="...">inner</span>
      const css = parseCssInlineStyle(match[3]);
      const spanInner = match[4];
      const childRuns = parseInlineRuns(spanInner, {
        ...inheritedStyle,
        bold: inheritedStyle.bold || css.bold,
        color: css.colorHex || inheritedStyle.color,
        highlight: css.bgHex || inheritedStyle.highlight,
        isBadge: css.isBadge || inheritedStyle.isBadge,
        fontSizePt: css.fontSizePt || inheritedStyle.fontSizePt,
      });
      if (css.isBadge && childRuns.length > 0) {
        childRuns[0].text = ` ${childRuns[0].text}`;
        childRuns[childRuns.length - 1].text = `${childRuns[childRuns.length - 1].text} `;
      }
      runs.push(...childRuns);
    } else if (match[5] !== undefined || match[6] !== undefined) {
      // ``code`` or `code`
      pushInherited({ type: 'code', text: (match[5] ?? match[6]).trim(), mono: true });
    } else if (match[7] !== undefined) {
      // ***bold italic***
      const innerRuns = parseInlineRuns(match[7], { ...inheritedStyle, bold: true, italic: true });
      runs.push(...innerRuns);
    } else if (match[8] !== undefined || match[9] !== undefined) {
      // **bold** or __bold__（支持递归解析内嵌行内代码，如 **`Absent`** 或 **`[ 📊 Export Excel ]`**）
      const innerRuns = parseInlineRuns(match[8] ?? match[9], { ...inheritedStyle, bold: true });
      runs.push(...innerRuns);
    } else if (match[10] !== undefined || match[11] !== undefined) {
      // *italic* or _italic_
      const innerRuns = parseInlineRuns(match[10] ?? match[11], { ...inheritedStyle, italic: true });
      runs.push(...innerRuns);
    } else if (match[12] !== undefined) {
      // ~~strike~~
      const innerRuns = parseInlineRuns(match[12], { ...inheritedStyle, strike: true });
      runs.push(...innerRuns);
    } else if (match[13] !== undefined) {
      // ==highlight==
      const innerRuns = parseInlineRuns(match[13], { ...inheritedStyle, highlight: 'FEF08A' });
      runs.push(...innerRuns);
    } else if (match[14] !== undefined || match[15] !== undefined) {
      // $$math$$ or $math$
      const mathClean = cleanLatexMath(match[14] ?? match[15]);
      pushInherited({ type: 'math', text: mathClean, italic: true });
    } else if (match[16] !== undefined && match[17] !== undefined) {
      // [label](url)
      pushInherited({ type: 'link', text: match[16], href: match[17] });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < raw.length) {
    pushInherited({ type: 'text', text: raw.slice(lastIndex) });
  }

  return runs;
}

/**
 * 提取纯文本（用于统计与预览，保留 <br> 换行）
 */
function stripInlineMarkdown(text) {
  return String(text || '')
    .split(/<br\s*\/?>|\n/i)
    .map((line) =>
      parseInlineRuns(line)
        .map((r) => r.text || '')
        .join('')
    )
    .join('\n');
}

/**
 * 切分 Markdown 表格行单元格（支持转义竖线 \| 以及行内代码 `a | b` 内的竖线保护）
 */
function splitTableCells(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) trimmed = trimmed.slice(0, -1);

  const cells = [];
  let current = '';
  let inBacktick = false;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '`' && (i === 0 || trimmed[i - 1] !== '\\')) {
      inBacktick = !inBacktick;
      current += trimmed[i];
    } else if (trimmed[i] === '\\' && trimmed[i + 1] === '|') {
      current += '|';
      i++;
    } else if (trimmed[i] === '|' && !inBacktick) {
      cells.push(current.trim());
      current = '';
    } else {
      current += trimmed[i];
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * 判断是否为 Markdown 表格对齐分隔行（如 | :--- | :---: | ---: |）
 */
function isTableSeparatorLine(line) {
  const trimmed = line.trim();
  if (!trimmed.includes('|') && !trimmed.includes('-')) return false;
  const cells = splitTableCells(trimmed);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));
}

/**
 * 将 Markdown / AI 文本解析为结构化 AST
 */
function parseMarkdownToAst(rawContent, options = {}) {
  const cleanAi = options.cleanAiArtifacts !== false;
  const lang = options.lang || 'zh';
  const isEn = lang === 'en' || (!/[\u4e00-\u9fa5]/.test(rawContent) && lang !== 'zh');
  const normalized = normalizeInputContent(rawContent, cleanAi);
  const lines = normalized.split('\n');

  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. 空行跳过
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. 围栏代码块 ```lang ... ```
    const fenceMatch = /^(`{3,}|~{3,})\s*([^\s`~]*)/.exec(trimmed);
    if (fenceMatch) {
      const fenceChar = fenceMatch[1][0];
      const fenceLen = fenceMatch[1].length;
      const closeFenceRe = new RegExp(`^\\s*${fenceChar}{${fenceLen},}\\s*$`);
      const language = fenceMatch[2] || '';
      const codeLines = [];
      i++;
      while (i < lines.length && !closeFenceRe.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // 跳过结束围栏
      const tokenizedLines = tokenizeCode(codeLines.join('\n'), language);
      blocks.push({
        type: 'code',
        language,
        lines: codeLines.length > 0 ? codeLines : [''],
        tokenizedLines,
        text: codeLines.join('\n'),
      });
      continue;
    }

    // 3. 块级数学公式 $$ ... $$
    if (trimmed.startsWith('$$')) {
      const mathLines = [];
      if (trimmed.length > 2 && trimmed.endsWith('$$') && trimmed !== '$$') {
        mathLines.push(trimmed.slice(2, -2).trim());
        i++;
      } else {
        const firstPart = trimmed.slice(2).trim();
        if (firstPart) mathLines.push(firstPart);
        i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$')) {
          mathLines.push(lines[i].trim());
          i++;
        }
        if (i < lines.length) {
          const lastPart = lines[i].trim().slice(0, -2).trim();
          if (lastPart) mathLines.push(lastPart);
          i++;
        }
      }
      blocks.push({
        type: 'paragraph',
        align: 'center',
        text: cleanLatexMath(mathLines.join(' ')),
        runs: [{ type: 'math', text: cleanLatexMath(mathLines.join(' ')), italic: true, bold: false }],
      });
      continue;
    }

    // 4. 水平分隔线 --- / *** / ___
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 5. Markdown 表格识别（当前行含 | 且下一行是表格分隔行）
    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparatorLine(lines[i + 1])
    ) {
      const headerCells = splitTableCells(trimmed);
      const alignCells = splitTableCells(lines[i + 1]);
      const alignments = alignCells.map((c) => {
        const s = c.trim();
        if (s.startsWith(':') && s.endsWith(':')) return 'center';
        if (s.endsWith(':')) return 'right';
        return 'left';
      });
      i += 2;
      const rows = [];
      while (i < lines.length) {
        const rowTrim = lines[i].trim();
        if (!rowTrim || !rowTrim.includes('|')) break;
        if (isTableSeparatorLine(rowTrim)) {
          i++;
          continue;
        }
        rows.push(splitTableCells(rowTrim));
        i++;
      }
      const colCount = Math.max(
        headerCells.length,
        ...rows.map((r) => r.length),
        1
      );
      const normalizeRow = (r) => {
        const copy = [...r];
        while (copy.length < colCount) copy.push('');
        return copy.slice(0, colCount);
      };
      blocks.push({
        type: 'table',
        headers: normalizeRow(headerCells),
        rows: rows.map(normalizeRow),
        alignments: Array.from({ length: colCount }, (_, idx) => alignments[idx] || 'left'),
      });
      continue;
    }

    // 6. ATX 标题 (# ~ ######)
    const headingMatch = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const rawHeading = headingMatch[2].trim();
      blocks.push({
        type: 'heading',
        level,
        text: stripInlineMarkdown(rawHeading),
        rawText: rawHeading,
        runs: parseInlineRuns(rawHeading),
      });
      i++;
      continue;
    }

    // 7. 公文无 # 号中式章节标题智能识别（如“一、总体要求”、“（一）工作目标”，且单行不超过 38 字、不以句号结尾）
    if (/^[一二三四五六七八九十百]+、\s*\S+/.test(trimmed) && trimmed.length <= 38 && !/[。；;]$/.test(trimmed)) {
      blocks.push({
        type: 'heading',
        level: 1,
        text: stripInlineMarkdown(trimmed),
        rawText: trimmed,
        runs: parseInlineRuns(trimmed),
      });
      i++;
      continue;
    }
    if (/^[（(][一二三四五六七八九十]+[)）]\s*\S+/.test(trimmed) && trimmed.length <= 38 && !/[。；;]$/.test(trimmed)) {
      blocks.push({
        type: 'heading',
        level: 2,
        text: stripInlineMarkdown(trimmed),
        rawText: trimmed,
        runs: parseInlineRuns(trimmed),
      });
      i++;
      continue;
    }

    // 8. 引用块 (> ...)
    if (trimmed.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const qContent = lines[i].trim().replace(/^>\s?/, '');
        // 过滤 GitHub 警告标记头如 [!NOTE]
        const alertMatch = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)/i.exec(qContent);
        if (alertMatch) {
          const alertType = alertMatch[1].toUpperCase();
          const labelMapZh = {
            NOTE: '【说明】',
            TIP: '【提示】',
            IMPORTANT: '【重要】',
            WARNING: '【注意】',
            CAUTION: '【警示】',
          };
          const prefix = isEn ? `[${alertType}]` : labelMapZh[alertType] || '【提示】';
          quoteLines.push(`**${prefix}**${alertMatch[2] ? ' ' + alertMatch[2] : ''}`);
        } else if (qContent) {
          quoteLines.push(qContent);
        }
        i++;
      }
      const joined = quoteLines.join('\n');
      blocks.push({
        type: 'blockquote',
        text: stripInlineMarkdown(joined),
        rawText: joined,
        runs: parseInlineRuns(joined),
      });
      continue;
    }

    // 9. 列表项（无序 -/*/+、有序 1./1)、任务复选框 - [x]，并兼容列表中夹杂缩进代码块与多行内容）
    const listMatch = /^(\s*)(?:([-*+•])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (listMatch) {
      const items = [];
      while (i < lines.length) {
        const curLine = lines[i];
        const curTrim = curLine.trim();
        if (!curTrim) {
          // 列表中间的单个空行：若下一行仍是列表项则继续合并为同一列表块
          if (i + 1 < lines.length && /^(\s*)(?:([-*+•])|(\d+)[.)])\s+/.test(lines[i + 1])) {
            i++;
            continue;
          }
          break;
        }
        const m = /^(\s*)(?:([-*+•])|(\d+)[.)])\s+(.*)$/.exec(curLine);
        if (!m) break;
        const indentSpaces = (m[1] || '').replace(/\t/g, '  ').length;
        const level = Math.min(4, Math.floor(indentSpaces / 2));
        const ordered = Boolean(m[3]);
        let itemBody = m[4].trim();
        let checked = null;
        const taskMatch = /^\[([ xX])\]\s+(.*)$/.exec(itemBody);
        if (taskMatch) {
          checked = taskMatch[1].toLowerCase() === 'x';
          itemBody = taskMatch[2].trim();
        }
        items.push({
          ordered,
          level,
          checked,
          text: stripInlineMarkdown(itemBody),
          rawText: itemBody,
          runs: parseInlineRuns(itemBody),
        });
        i++;
      }
      blocks.push({
        type: 'list',
        items,
      });
      continue;
    }

    // 10. 普通段落（将连续非特殊行合并为自然段落，若遇到孤立换行则衔接）
    const paraLines = [];
    while (i < lines.length) {
      const cur = lines[i];
      const curTrim = cur.trim();
      if (
        !curTrim ||
        /^(`{3,}|~{3,})/.test(curTrim) ||
        curTrim.startsWith('$$') ||
        /^(?:-{3,}|\*{3,}|_{3,})$/.test(curTrim) ||
        /^(#{1,6})\s+/.test(curTrim) ||
        curTrim.startsWith('>') ||
        /^(\s*)(?:([-*+•])|(\d+)[.)])\s+/.test(cur) ||
        (curTrim.includes('|') && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1])) ||
        (/^[一二三四五六七八九十百]+、\s*\S+/.test(curTrim) && curTrim.length <= 38 && !/[。；;]$/.test(curTrim)) ||
        (/^[（(][一二三四五六七八九十]+[)）]\s*\S+/.test(curTrim) && curTrim.length <= 38 && !/[。；;]$/.test(curTrim))
      ) {
        break;
      }
      paraLines.push(curTrim);
      i++;
      // 在中文公文或 AI 报告中，单行独立自然段很常见，因此每行默认作为独立段落，除非行尾带有硬换行反斜杠
      if (!curTrim.endsWith('\\')) {
        break;
      }
    }
    const rawPara = paraLines.map((l) => l.replace(/\\$/, '')).join(' ');
    if (rawPara) {
      blocks.push({
        type: 'paragraph',
        text: stripInlineMarkdown(rawPara),
        rawText: rawPara,
        runs: parseInlineRuns(rawPara),
      });
    }
  }

  // 自动提取主标题（若首个块为 H1/H2 或首段独立标题）
  let detectedTitle = '';
  if (options.documentTitle && String(options.documentTitle).trim()) {
    detectedTitle = String(options.documentTitle).trim();
  } else if (blocks.length > 0 && blocks[0].type === 'heading' && blocks[0].level <= 2) {
    detectedTitle = blocks[0].text;
  } else if (
    blocks.length > 0 &&
    blocks[0].type === 'paragraph' &&
    blocks[0].text.length <= 180 &&
    !/[。！？；.!?;]$/.test(blocks[0].text)
  ) {
    detectedTitle = blocks[0].text;
  }

  // 统计摘要
  const plainAll = blocks
    .map((b) => {
      if (b.type === 'table') {
        return [b.headers.join(' '), ...b.rows.map((r) => r.join(' '))].join(' ');
      }
      if (b.type === 'list') {
        return b.items.map((it) => it.text).join(' ');
      }
      return b.text || '';
    })
    .join('\n');

  const charCount = plainAll.replace(/\s+/g, '').length;
  const cjkChars = (plainAll.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinWords = (plainAll.replace(/[\u4e00-\u9fff]/g, ' ').match(/[a-zA-Z0-9_]+/g) || []).length;
  const wordCount = cjkChars + latinWords;

  const outline = blocks
    .filter((b) => b.type === 'heading')
    .map((b) => ({ level: b.level, text: b.text }));

  const stats = {
    charCount,
    wordCount,
    headingCount: outline.length,
    tableCount: blocks.filter((b) => b.type === 'table').length,
    listItemCount: blocks
      .filter((b) => b.type === 'list')
      .reduce((acc, b) => acc + b.items.length, 0),
    codeBlockCount: blocks.filter((b) => b.type === 'code').length,
    quoteCount: blocks.filter((b) => b.type === 'blockquote').length,
  };

  return {
    normalizedMarkdown: normalized,
    detectedTitle,
    stats,
    outline,
    blocks,
  };
}

/**
 * 构建多级独立列表 Numbering 配置（吸收自 genoffice/packages/html2docx/src/generate/numbering.ts）
 * 确保每个有序列表从 1. 重新开始编号，绝不跨段连号
 */
function buildNumberingConfig(maxOrderedInstances = 32, fontConfig) {
  const configs = [
    {
      reference: 'xc-ul-bullet',
      levels: ['•', '◦', '▪', '•', '◦'].map((glyph, level) => ({
        level,
        format: LevelFormat.BULLET,
        text: glyph,
        suffix: LevelSuffix.SPACE,
        style: {
          paragraph: {
            indent: { left: 420 * (level + 1), hanging: 260 },
          },
        },
      })),
    },
  ];

  for (let inst = 0; inst < Math.max(8, maxOrderedInstances); inst++) {
    configs.push({
      reference: `xc-ol-${inst}`,
      levels: Array.from({ length: 5 }, (_, level) => ({
        level,
        format: LevelFormat.DECIMAL,
        text: `%${level + 1}.`,
        suffix: LevelSuffix.SPACE,
        start: 1,
        style: {
          paragraph: {
            indent: { left: 420 * (level + 1), hanging: 260 },
          },
          run: {
            font: fontConfig.bodyFont,
            size: fontConfig.bodySize,
          },
        },
      })),
    });
  }

  return configs;
}

/**
 * 三套高标准预设模板样式配置
 */
function getTemplateTheme(template = 'gov-redhead') {
  if (template === 'business-report') {
    return {
      id: 'business-report',
      pageMargins: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 2.54cm 标准页边距
      contentDxa: 11906 - 2880,
      titleFont: { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Microsoft YaHei' },
      titleSize: 40, // 20pt
      titleColor: '0F172A',
      h1Font: { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Microsoft YaHei' },
      h1Size: 30, // 15pt
      h1Color: '1E3A8A',
      h2Font: { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Microsoft YaHei' },
      h2Size: 26, // 13pt
      h2Color: '1E293B',
      h3Font: { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Microsoft YaHei' },
      h3Size: 23, // 11.5pt
      h3Color: '334155',
      bodyFont: { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Microsoft YaHei' },
      bodySize: 22, // 11pt
      bodyColor: '1E293B',
      lineSpacing: 360, // 1.5倍行距
      lineRule: LineRuleType.AUTO,
      paraBefore: 60,
      paraAfter: 140,
      firstLineIndentDxa: 440,
      tableHeaderFill: '1E3A8A',
      tableHeaderColor: 'FFFFFF',
      tableZebraFill: 'F8FAFC',
      tableBorderColor: 'CBD5E1',
      threeLineTable: false,
    };
  }

  if (template === 'academic-paper') {
    return {
      id: 'academic-paper',
      pageMargins: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
      contentDxa: 11906 - 2880,
      titleFont: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'SimHei' },
      titleSize: 36, // 18pt 小二
      titleColor: '000000',
      h1Font: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'SimHei' },
      h1Size: 28, // 14pt 四号
      h1Color: '000000',
      h2Font: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'SimHei' },
      h2Size: 24, // 12pt 小四
      h2Color: '000000',
      h3Font: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'SimSun' },
      h3Size: 24, // 12pt 小四加粗
      h3Color: '000000',
      bodyFont: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'SimSun' },
      bodySize: 24, // 12pt 小四
      bodyColor: '000000',
      lineSpacing: 360, // 1.5倍行距
      lineRule: LineRuleType.AUTO,
      paraBefore: 0,
      paraAfter: 80,
      firstLineIndentDxa: 480,
      tableHeaderFill: 'FFFFFF',
      tableHeaderColor: '000000',
      tableZebraFill: null,
      tableBorderColor: '000000',
      threeLineTable: true, // 标准学术三线表
    };
  }

  // 默认：'gov-redhead' (GB/T 9704 党政/企事业标准红头公文)
  return {
    id: 'gov-redhead',
    // 上 3.7cm (2098 dxa)，下 3.5cm (1984 dxa)，左 2.8cm (1587 dxa)，右 2.6cm (1474 dxa)
    pageMargins: { top: 2098, bottom: 1984, left: 1587, right: 1474 },
    contentDxa: 11906 - 1587 - 1474,
    titleFont: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'SimSun' },
    titleSize: 44, // 22pt 二号
    titleColor: '000000',
    h1Font: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'SimHei' },
    h1Size: 32, // 16pt 三号黑体
    h1Color: '000000',
    h2Font: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'KaiTi' },
    h2Size: 32, // 16pt 三号楷体
    h2Color: '000000',
    h3Font: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'FangSong' },
    h3Size: 32, // 16pt 三号仿宋加粗
    h3Color: '000000',
    bodyFont: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'FangSong' },
    bodySize: 32, // 16pt 三号仿宋
    bodyColor: '000000',
    lineSpacing: 560, // 28磅固定行距 (28 * 20 = 560 dxa)
    lineRule: LineRuleType.EXACT,
    paraBefore: 0,
    paraAfter: 0,
    firstLineIndentDxa: 640, // 首行缩进 2 字符 (16pt * 2 * 20 = 640 dxa)
    tableHeaderFill: 'F3F4F6',
    tableHeaderColor: '000000',
    tableZebraFill: null,
    tableBorderColor: '333333',
    threeLineTable: false,
  };
}

/**
 * 将 AST 内联 Runs 转换为 docx TextRun / ExternalHyperlink 数组
 * 吸收自 genoffice/packages/html2docx/src/generate/word-utils.ts
 */
function buildDocxRuns(runs, baseStyle) {
  const out = [];
  for (const r of runs || []) {
    const isCode = r.type === 'code' || r.mono;
    const isMath = r.type === 'math';
    const isLink = r.type === 'link' && r.href;

    const font = isCode
      ? { ascii: 'Consolas', hAnsi: 'Consolas', eastAsia: 'Microsoft YaHei' }
      : isMath
        ? { ascii: 'Cambria Math', hAnsi: 'Cambria Math', eastAsia: baseStyle.font.eastAsia }
        : baseStyle.font;

    const size = r.fontSizePt
      ? Math.max(16, Math.round(r.fontSizePt * 2))
      : isCode
        ? Math.max(18, baseStyle.size - 2)
        : baseStyle.size;

    const color = isLink
      ? '2563EB'
      : isCode
        ? 'BE185D'
        : r.color || baseStyle.color || '000000';

    const shading = r.highlight
      ? { type: ShadingType.CLEAR, fill: r.highlight }
      : isCode
        ? { type: ShadingType.CLEAR, fill: 'F1F5F9' }
        : undefined;

    const border = isCode
      ? {
          style: BorderStyle.SINGLE,
          size: 4,
          color: 'CBD5E1',
          space: 1,
        }
      : r.isBadge
        ? {
            style: BorderStyle.SINGLE,
            size: 4,
            color: r.color || '94A3B8',
            space: 1,
          }
        : undefined;

    const lines = String(r.text || '').split('\n');
    lines.forEach((seg, idx) => {
      const containsEmoji = !isCode && !isMath && EMOJI_INLINE_REGEX.test(seg);

      if (!containsEmoji) {
        const tr = new TextRun({
          text: seg,
          break: idx > 0 ? 1 : undefined,
          font,
          size,
          color,
          bold: Boolean(r.bold || baseStyle.bold),
          italics: Boolean(r.italic || baseStyle.italic),
          strike: r.strike || undefined,
          underline: isLink ? { type: 'single', color: '2563EB' } : undefined,
          shading,
          border,
          noProof: true,
        });

        if (isLink) {
          out.push(
            new ExternalHyperlink({
              link: r.href,
              children: [tr],
            })
          );
        } else {
          out.push(tr);
        }
      } else {
        const fragments = splitTextAndEmoji(seg);
        const emojiPx = Math.max(12, Math.min(36, Math.round((size / 2) * 1.05)));

        fragments.forEach((frag, fragIdx) => {
          const isFirstItem = idx > 0 && fragIdx === 0;

          if (frag.isEmoji) {
            const pngBuf = getEmojiPngBuffer(frag.text);
            if (pngBuf) {
              if (isFirstItem) {
                out.push(new TextRun({ break: 1, noProof: true }));
              }
              const imgRun = new ImageRun({
                data: pngBuf,
                transformation: {
                  width: emojiPx,
                  height: emojiPx,
                },
                type: 'png',
              });

              if (isLink) {
                out.push(new ExternalHyperlink({ link: r.href, children: [imgRun] }));
              } else {
                out.push(imgRun);
              }
              return;
            }
          }

          const tr = new TextRun({
            text: frag.text,
            break: isFirstItem ? 1 : undefined,
            font,
            size,
            color,
            bold: Boolean(r.bold || baseStyle.bold),
            italics: Boolean(r.italic || baseStyle.italic),
            strike: r.strike || undefined,
            underline: isLink ? { type: 'single', color: '2563EB' } : undefined,
            shading,
            border,
            noProof: true,
          });

          if (isLink) {
            out.push(
              new ExternalHyperlink({
                link: r.href,
                children: [tr],
              })
            );
          } else {
            out.push(tr);
          }
        });
      }
    });
  }
  return out;
}

/**
 * 估算文本视觉宽度权重（中文字符按 2 单位，西文按 1.1 单位），用于动态列宽防挤压计算
 */
function measureCellVisualUnits(text) {
  const s = String(text || '').trim();
  if (!s) return 2;
  // 若单元格内有多行，取最长一行
  const lines = s.split(/\n|\s\/\s/);
  let maxUnits = 2;
  for (const line of lines) {
    let units = 0;
    for (const ch of line) {
      units += /[\u2e80-\u9fff\uff00-\uffef]/.test(ch) ? 2.0 : 1.1;
    }
    if (units > maxUnits) maxUnits = units;
  }
  return maxUnits;
}

/**
 * 动态计算表格各列 DXA 宽度并应用最小可读列宽下限（吸收自 genoffice table-renderers.ts TEXT_COL_FLOOR_DXA）
 */
function computeSmartColumnWidths(tableBlock, totalContentDxa) {
  const colCount = Math.max(1, tableBlock.headers.length);
  const maxUnitsPerCol = Array.from({ length: colCount }, () => 3);

  tableBlock.headers.forEach((h, c) => {
    maxUnitsPerCol[c] = Math.max(
      maxUnitsPerCol[c],
      measureCellVisualUnits(stripInlineMarkdown(h)) * 1.2 + 3.2
    );
  });
  for (const row of tableBlock.rows) {
    row.forEach((cell, c) => {
      if (c < colCount) {
        // 对超长描述列使用对数阻尼，并为短列附加单元格内边距余量，避免短词（如“100% 还原”）被折行
        const rawUnits = measureCellVisualUnits(stripInlineMarkdown(cell)) + 3.2;
        const damped = rawUnits > 18 ? 18 + Math.sqrt(rawUnits - 18) * 2.4 : rawUnits;
        maxUnitsPerCol[c] = Math.max(maxUnitsPerCol[c], damped);
      }
    });
  }

  const totalUnits = maxUnitsPerCol.reduce((a, b) => a + b, 0) || 1;
  const colDxa = maxUnitsPerCol.map((u) => Math.round((u / totalUnits) * totalContentDxa));

  // 最小可读宽度地板保护（防止窄列变 1 字 1 行竖排）
  const floorDxa = Math.min(1150, Math.floor(totalContentDxa / (colCount * 1.35)));
  for (let c = 0; c < colCount; c++) {
    if (colDxa[c] < floorDxa) {
      let deficit = floorDxa - colDxa[c];
      const donors = colDxa
        .map((w, j) => ({ j, slack: j === c ? 0 : w - floorDxa }))
        .filter((d) => d.slack > 0)
        .sort((a, b) => b.slack - a.slack);
      for (const donor of donors) {
        if (deficit <= 0) break;
        const take = Math.min(deficit, donor.slack);
        colDxa[donor.j] -= take;
        deficit -= take;
      }
      colDxa[c] = floorDxa - Math.max(0, deficit);
    }
  }

  // 修正四舍五入总和误差
  const sum = colDxa.reduce((a, b) => a + b, 0);
  if (colDxa.length > 0 && sum !== totalContentDxa) {
    colDxa[colDxa.length - 1] += totalContentDxa - sum;
  }

  return colDxa;
}

/**
 * 渲染高保真 OOXML 表格（支持红头公文网格表、商务斑马纹表、学术标准三线表）
 */
function renderDocxTable(tableBlock, theme) {
  const colWidths = computeSmartColumnWidths(tableBlock, theme.contentDxa);
  const colCount = colWidths.length;
  const allRows = [tableBlock.headers, ...tableBlock.rows];
  const keepWhole = allRows.length <= 6; // 6 行以内短表保持同页不拆断，中长表自然跨页并自动重复表头

  const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto' };
  const gridBorder = {
    style: BorderStyle.SINGLE,
    size: 6,
    color: theme.tableBorderColor,
  };

  const docxRows = allRows.map((rowCells, rowIdx) => {
    const isHeader = rowIdx === 0;
    const isLastRow = rowIdx === allRows.length - 1;

    const cells = Array.from({ length: colCount }, (_, colIdx) => {
      const rawCell = rowCells[colIdx] || '';
      const alignStr = tableBlock.alignments?.[colIdx] || (isHeader ? 'center' : 'left');
      const alignment =
        alignStr === 'center'
          ? AlignmentType.CENTER
          : alignStr === 'right'
            ? AlignmentType.RIGHT
            : isHeader && theme.id === 'gov-redhead'
              ? AlignmentType.CENTER
              : AlignmentType.LEFT;

      const cellFontSize = Math.max(20, theme.bodySize - (theme.id === 'gov-redhead' ? 6 : 2)); // 表格字号适度精炼(如公文表用小四 24 / 五号 21)

      let borders;
      if (theme.threeLineTable) {
        // 标准学术三线表：顶线 1.5pt(12)，表头底线 0.75pt(6)，末行底线 1.5pt(12)，无竖线与内横线
        borders = {
          top: isHeader
            ? { style: BorderStyle.SINGLE, size: 12, color: '000000' }
            : NO_BORDER,
          bottom: isHeader
            ? { style: BorderStyle.SINGLE, size: 6, color: '000000' }
            : isLastRow
              ? { style: BorderStyle.SINGLE, size: 12, color: '000000' }
              : NO_BORDER,
          left: NO_BORDER,
          right: NO_BORDER,
        };
      } else {
        borders = {
          top: gridBorder,
          bottom: gridBorder,
          left: gridBorder,
          right: gridBorder,
        };
      }

      const fillHex = isHeader
        ? theme.tableHeaderFill
        : theme.tableZebraFill && rowIdx % 2 === 0
          ? theme.tableZebraFill
          : 'FFFFFF';

      const shading =
        fillHex && fillHex !== 'FFFFFF'
          ? { type: ShadingType.CLEAR, fill: fillHex }
          : undefined;

      // 将单元格内通过 <br> 换行的内容拆分为独立子段落，确保每一行都严格遵循居中/左对齐且徽章与副标题上下间距优雅
      const rawLines = String(rawCell).split(/<br\s*\/?>|\n/i);
      const cellParagraphs = rawLines.map((lineText, lineIdx) => {
        const lineRuns = parseInlineRuns(lineText.trim());
        const isLastLineInCell = lineIdx === rawLines.length - 1;
        return new Paragraph({
          alignment,
          keepNext: (keepWhole && !isLastRow) || !isLastLineInCell ? true : undefined,
          keepLines: true,
          spacing: {
            before: lineIdx === 0 ? 20 : 12,
            after: isLastLineInCell ? 20 : 12,
            line: 260,
            lineRule: LineRuleType.AUTO,
          },
          children:
            lineRuns.length > 0
              ? buildDocxRuns(lineRuns, {
                  font: isHeader ? theme.h2Font : theme.bodyFont,
                  size: cellFontSize,
                  color: isHeader ? theme.tableHeaderColor : theme.bodyColor,
                  bold: isHeader,
                })
              : [new TextRun({ text: '' })],
        });
      });

      return new TableCell({
        width: { size: colWidths[colIdx], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        borders,
        shading,
        margins: {
          top: 100,
          bottom: 100,
          left: 140,
          right: 140,
        },
        children: cellParagraphs,
      });
    });

    return new TableRow({
      tableHeader: isHeader,
      cantSplit: true,
      children: cells,
    });
  });

  const tableBorders = theme.threeLineTable
    ? {
        top: { style: BorderStyle.SINGLE, size: 12, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000' },
        left: NO_BORDER,
        right: NO_BORDER,
        insideHorizontal: NO_BORDER,
        insideVertical: NO_BORDER,
      }
    : {
        top: gridBorder,
        bottom: gridBorder,
        left: gridBorder,
        right: gridBorder,
        insideHorizontal: gridBorder,
        insideVertical: gridBorder,
      };

  return new Table({
    width: { size: theme.contentDxa, type: WidthType.DXA },
    columnWidths: colWidths,
    layout: TableLayoutType.FIXED,
    borders: tableBorders,
    rows: docxRows,
  });
}

/**
 * 核心：检查并预览 Markdown / AI 内容结构
 */
async function inspectMarkdown({
  content,
  fileBuffer,
  fileName = 'document.md',
  cleanAiArtifacts = true,
  lang = 'zh',
}) {
  let rawText = content || '';
  if (!rawText && fileBuffer) {
    rawText = decodeInputBuffer(fileBuffer);
  }
  const ast = parseMarkdownToAst(rawText, { cleanAiArtifacts, lang });
  return {
    success: true,
    fileName,
    normalizedMarkdown: ast.normalizedMarkdown,
    detectedTitle: ast.detectedTitle,
    stats: ast.stats,
    outline: ast.outline,
    previewBlocks: ast.blocks.slice(0, 250).map((b) => ({
      type: b.type,
      level: b.level,
      text: b.text,
      runs: b.runs,
      headers: b.headers ? b.headers.map((h) => stripInlineMarkdown(h)) : undefined,
      rows: b.rows
        ? b.rows.slice(0, 50).map((r) => r.map((c) => stripInlineMarkdown(c)))
        : undefined,
      richRows: b.rows
        ? b.rows.slice(0, 50).map((r) =>
            r.map((c) =>
              String(c)
                .split(/<br\s*\/?>|\n/i)
                .map((lineStr) => parseInlineRuns(lineStr.trim()))
            )
          )
        : undefined,
      alignments: b.alignments,
      items: b.items
        ? b.items.slice(0, 50).map((it) => ({
            text: it.text,
            runs: it.runs,
            ordered: it.ordered,
            level: it.level,
            checked: it.checked,
          }))
        : undefined,
      language: b.language,
      lines: b.lines ? b.lines.slice(0, 120) : undefined,
      tokenizedLines: b.tokenizedLines ? b.tokenizedLines.slice(0, 150) : undefined,
    })),
  };
}

/**
 * 核心：一键编译生成带规范红头/商务/学术样式的标准 Word (.docx)
 */
async function markdownToWord({
  content,
  fileBuffer,
  fileName = 'AI_Document.md',
  template = 'gov-redhead',
  documentTitle = '',
  enableRedHeader = true,
  redHeaderOrg = '',
  docNumber = '',
  firstLineIndent = true,
  includePageNumbers = true,
  headerText = '',
  cleanAiArtifacts = true,
  lang = 'zh',
}) {
  let rawText = content || '';
  if (!rawText && fileBuffer) {
    rawText = decodeInputBuffer(fileBuffer);
  }

  const isEn = lang === 'en' || (!/[\u4e00-\u9fa5]/.test(rawText) && lang !== 'zh');
  const orgTitle = (
    redHeaderOrg ||
    (isEn ? 'XC Executive Office Document' : 'XC 万象办公文件')
  ).trim();
  const issueDocNumber = (
    docNumber ||
    (isEn ? 'DOC-2026-01' : '万象发〔2026〕01号')
  ).trim();

  const ast = parseMarkdownToAst(rawText, { cleanAiArtifacts, documentTitle, lang: isEn ? 'en' : 'zh' });
  const theme = getTemplateTheme(template);
  const children = [];

  // 1. 若为红头公文模式且启用了红头版式，生成标准红头版头 + 发文字号 + 红头文武双线
  if (template === 'gov-redhead' && enableRedHeader) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        keepNext: true,
        keepLines: true,
        spacing: { before: 0, after: 160, line: 680, lineRule: LineRuleType.EXACT },
        children: [
          new TextRun({
            text: orgTitle,
            font: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'SimSun' },
            size: 56, // 28pt 大红头
            bold: true,
            color: 'D40000',
            characterSpacing: 40,
            noProof: true,
          }),
        ],
      })
    );

    // 发文字号 + 底部红色文武线（DOUBLE 边框）
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        keepNext: true,
        keepLines: true,
        border: {
          bottom: {
            style: BorderStyle.DOUBLE,
            size: 12,
            color: 'D40000',
            space: 8,
          },
        },
        spacing: { before: 40, after: 320, line: 400, lineRule: LineRuleType.EXACT },
        children: [
          new TextRun({
            text: issueDocNumber || ' ',
            font: theme.bodyFont,
            size: 32, // 三号仿宋
            color: '000000',
            noProof: true,
          }),
        ],
      })
    );
  }

  // 2. 渲染文档主标题（若指定了 documentTitle，或首个块是 H1 标题则提升为居中文档主标题）
  const explicitTitle = (documentTitle || '').trim();
  let startBlockIdx = 0;
  let mainTitleText = explicitTitle || ast.detectedTitle || '';

  if (!explicitTitle && ast.blocks.length > 0 && (ast.blocks[0].text === mainTitleText || ast.blocks[0].level === 1)) {
    startBlockIdx = 1;
  } else if (explicitTitle && ast.blocks.length > 0 && ast.blocks[0].text === explicitTitle) {
    startBlockIdx = 1;
  }

  if (mainTitleText) {
    children.push(
      new Paragraph({
        alignment: template === 'business-report' ? AlignmentType.LEFT : AlignmentType.CENTER,
        keepNext: true,
        keepLines: true,
        border:
          template === 'business-report'
            ? {
                bottom: {
                  style: BorderStyle.SINGLE,
                  size: 16,
                  color: '2563EB',
                  space: 8,
                },
              }
            : undefined,
        spacing: {
          before: template === 'gov-redhead' ? 240 : 120,
          after: template === 'gov-redhead' ? 280 : 240,
          line: template === 'gov-redhead' ? 560 : 320,
          lineRule: template === 'gov-redhead' ? LineRuleType.EXACT : LineRuleType.AUTO,
        },
        children: buildDocxRuns(
          [{ type: 'text', text: mainTitleText }],
          {
            font: theme.titleFont,
            size: theme.titleSize,
            bold: true,
            color: theme.titleColor,
          },
          template
        ),
      })
    );
  }

  // 3. 遍历 AST 块生成高保真 OOXML 节点
  let olInstanceCounter = 0;
  let autoH1Index = 0;
  const CN_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];

  const remainingHeadings = ast.blocks
    .slice(startBlockIdx)
    .filter((b) => b.type === 'heading');
  const minHeadingLvl =
    remainingHeadings.length > 0
      ? Math.min(...remainingHeadings.map((h) => h.level || 1))
      : 1;
  const headingShift = minHeadingLvl > 1 ? minHeadingLvl - 1 : 0;

  for (let idx = startBlockIdx; idx < ast.blocks.length; idx++) {
    const block = ast.blocks[idx];

    if (block.type === 'heading') {
      const lvl = Math.min(6, Math.max(1, (block.level || 1) - headingShift));
      const headingFont = lvl === 1 ? theme.h1Font : lvl === 2 ? theme.h2Font : theme.h3Font;
      const headingSize = lvl === 1 ? theme.h1Size : lvl === 2 ? theme.h2Size : theme.h3Size;
      const headingColor = lvl === 1 ? theme.h1Color : lvl === 2 ? theme.h2Color : theme.h3Color;

      // 公文模式下，若一级标题未带“一、”或“第X章”或“Part X”编号，且存在多个章节，赋予标准中文序号
      let runsToRender = block.runs;
      if (
        !isEn &&
        template === 'gov-redhead' &&
        lvl === 1 &&
        !/^([一二三四五六七八九十百]+、|第[一二三四五六七八九十百\d]+[章节部分]|\d+[.、]|(?:Part|Step|Section|Chapter|Phase)\s*\d+)/i.test(block.text)
      ) {
        const cnPrefix = CN_NUMS[autoH1Index] ? `${CN_NUMS[autoH1Index]}、` : '';
        autoH1Index++;
        if (cnPrefix) {
          runsToRender = [{ type: 'text', text: cnPrefix, bold: true }, ...block.runs];
        }
      }

      const headingLevelsMap = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
        HeadingLevel.HEADING_5,
        HeadingLevel.HEADING_6,
      ];

      children.push(
        new Paragraph({
          heading: headingLevelsMap[lvl - 1],
          keepNext: true,
          keepLines: true,
          indent:
            template === 'gov-redhead' && firstLineIndent
              ? { firstLine: theme.firstLineIndentDxa }
              : undefined,
          border:
            template === 'business-report' && lvl === 1
              ? {
                  left: {
                    style: BorderStyle.SINGLE,
                    size: 24,
                    color: '2563EB',
                    space: 8,
                  },
                }
              : template === 'business-report' && lvl === 2
                ? {
                    bottom: {
                      style: BorderStyle.SINGLE,
                      size: 6,
                      color: 'CBD5E1',
                      space: 4,
                    },
                  }
                : undefined,
          shading:
            template === 'business-report' && lvl === 1
              ? { type: ShadingType.CLEAR, fill: 'EFF6FF' }
              : undefined,
          spacing: {
            before: template === 'gov-redhead' ? 160 : lvl === 1 ? 260 : 180,
            after: template === 'gov-redhead' ? 80 : lvl === 1 ? 120 : 80,
            line: theme.lineSpacing,
            lineRule: theme.lineRule,
          },
          children: buildDocxRuns(runsToRender, {
            font: headingFont,
            size: headingSize,
            color: headingColor,
            bold: true,
          }),
        })
      );
      continue;
    }

    if (block.type === 'paragraph') {
      const isCentered = block.align === 'center';
      children.push(
        new Paragraph({
          alignment: isCentered ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
          indent:
            !isCentered && firstLineIndent
              ? { firstLine: theme.firstLineIndentDxa }
              : undefined,
          spacing: {
            before: theme.paraBefore,
            after: theme.paraAfter,
            line: theme.lineSpacing,
            lineRule: theme.lineRule,
          },
          children: buildDocxRuns(block.runs, {
            font: theme.bodyFont,
            size: theme.bodySize,
            color: theme.bodyColor,
            bold: false,
          }),
        })
      );
      continue;
    }

    if (block.type === 'blockquote') {
      const quoteSubLines = String(block.rawText || block.text || '').split('\n');
      quoteSubLines.forEach((qLine, qIdx) => {
        const qRuns = parseInlineRuns(qLine.trim());
        const isFirstQ = qIdx === 0;
        const isLastQ = qIdx === quoteSubLines.length - 1;
        children.push(
          new Paragraph({
            indent: { left: 420, right: 240 },
            border: {
              left: {
                style: BorderStyle.SINGLE,
                size: 18,
                color: template === 'gov-redhead' ? 'D40000' : '3B82F6',
                space: 10,
              },
            },
            shading: {
              type: ShadingType.CLEAR,
              fill: template === 'gov-redhead' ? 'FEF2F2' : 'F8FAFC',
            },
            spacing: {
              before: isFirstQ ? 100 : 20,
              after: isLastQ ? 100 : 20,
              line: 320,
              lineRule: LineRuleType.AUTO,
            },
            children:
              qRuns.length > 0
                ? buildDocxRuns(qRuns, {
                    font: theme.bodyFont,
                    size: Math.max(20, theme.bodySize - 2),
                    color: '334155',
                    italic: false,
                  })
                : [new TextRun({ text: ' ' })],
          })
        );
      });
      continue;
    }

    if (block.type === 'list') {
      const currentOlRef = `xc-ol-${olInstanceCounter++}`;
      for (const item of block.items) {
        const itemChildren = [];
        if (item.checked !== null && item.checked !== undefined) {
          itemChildren.push(new CheckBox({ checked: Boolean(item.checked) }));
          itemChildren.push(
            new TextRun({
              text: ' ',
              font: theme.bodyFont,
              size: theme.bodySize,
            })
          );
        }
        itemChildren.push(
          ...buildDocxRuns(item.runs, {
            font: theme.bodyFont,
            size: theme.bodySize,
            color: theme.bodyColor,
          })
        );

        children.push(
          new Paragraph({
            numbering:
              item.checked !== null && item.checked !== undefined
                ? undefined
                : {
                    reference: item.ordered ? currentOlRef : 'xc-ul-bullet',
                    level: Math.min(4, item.level || 0),
                  },
            indent:
              item.checked !== null && item.checked !== undefined
                ? { left: 420 * ((item.level || 0) + 1) }
                : undefined,
            spacing: {
              before: 40,
              after: 60,
              line: theme.lineSpacing,
              lineRule: theme.lineRule,
            },
            children: itemChildren,
          })
        );
      }
      continue;
    }

    if (block.type === 'code') {
      const tokenizedLines =
        block.tokenizedLines || tokenizeCode((block.lines || []).join('\n'), block.language);
      const codeParagraphs = tokenizedLines.map((lineTokens, lineIdx) => {
        const runs = (lineTokens.length > 0 ? lineTokens : [{ text: ' ', color: 'D4D4D4' }]).map(
          (tok, tokIdx) => {
            let txt = tok.text || ' ';
            if (tokIdx === 0) {
              // 将代码行首缩进空格转为不间断空格 \u00A0，防止 Word XML 吞噬前导缩进
              txt = txt.replace(/^[ \t]+/, (m) => m.replace(/\t/g, '  ').replace(/ /g, '\u00A0'));
            }
            return new TextRun({
              text: txt,
              font: { ascii: 'Consolas', hAnsi: 'Consolas', eastAsia: 'Microsoft YaHei' },
              size: 19, // 9.5pt
              color: tok.color || 'D4D4D4',
              italics: Boolean(tok.italic),
              noProof: true,
            });
          }
        );
        return new Paragraph({
          alignment: AlignmentType.LEFT,
          keepLines: true,
          keepNext:
            tokenizedLines.length <= 15 && lineIdx < tokenizedLines.length - 1
              ? true
              : undefined,
          spacing: {
            before: 0,
            after: 0,
            line: 260,
            lineRule: LineRuleType.AUTO,
          },
          children: runs,
        });
      });

      const codeTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: '2D2D2D' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: '2D2D2D' },
          left: { style: BorderStyle.SINGLE, size: 18, color: '007ACC' },
          right: { style: BorderStyle.SINGLE, size: 4, color: '2D2D2D' },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: '1E1E1E' },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: '2D2D2D' },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: '2D2D2D' },
                  left: { style: BorderStyle.SINGLE, size: 18, color: '007ACC' },
                  right: { style: BorderStyle.SINGLE, size: 4, color: '2D2D2D' },
                },
                margins: {
                  top: 140,
                  bottom: 140,
                  left: 180,
                  right: 180,
                },
                children:
                  codeParagraphs.length > 0 ? codeParagraphs : [new Paragraph({ children: [] })],
              }),
            ],
          }),
        ],
      });

      children.push(codeTable);
      children.push(
        new Paragraph({
          spacing: { before: 0, after: 120, line: 120, lineRule: LineRuleType.EXACT },
          children: [],
        })
      );
      continue;
    }

    if (block.type === 'table') {
      // 表格前后留白段，防止紧贴正文
      children.push(renderDocxTable(block, theme));
      children.push(
        new Paragraph({
          spacing: { before: 0, after: 120, line: 120, lineRule: LineRuleType.EXACT },
          children: [],
        })
      );
      continue;
    }

    if (block.type === 'hr') {
      children.push(
        new Paragraph({
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: 'CBD5E1',
              space: 6,
            },
          },
          spacing: { before: 160, after: 160 },
          children: [],
        })
      );
      continue;
    }
  }

  // 4. 吸收自 genoffice page-settings.ts：确保文档末尾必定是一个 Paragraph，防止以 Table 结尾触发空白溢出页
  if (children.length === 0 || !(children[children.length - 1] instanceof Paragraph)) {
    children.push(
      new Paragraph({
        children: [],
        spacing: { before: 0, after: 0, line: 1, lineRule: LineRuleType.EXACT },
      })
    );
  }

  // 5. 构建页眉与原生动态页码页脚（吸收自 genoffice page-settings.ts PAGE / NUMPAGES 域）
  const headers =
    headerText && String(headerText).trim()
      ? {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: 'CBD5E1',
                    space: 4,
                  },
                },
                spacing: { after: 120 },
                children: [
                  new TextRun({
                    text: String(headerText).trim(),
                    font: theme.bodyFont,
                    size: 18,
                    color: '64748B',
                  }),
                ],
              }),
            ],
          }),
        }
      : undefined;

  const footers = includePageNumbers
    ? {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  children: isEn
                    ? ['— Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES, ' —']
                    : ['— 第 ', PageNumber.CURRENT, ' 页 / 共 ', PageNumber.TOTAL_PAGES, ' 页 —'],
                  font: isEn
                    ? { ascii: 'Times New Roman', hAnsi: 'Times New Roman' }
                    : { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: 'SimSun' },
                  size: 20, // 10pt
                  color: '475569',
                }),
              ],
            }),
          ],
        }),
      }
    : undefined;

  // 6. 组装 OOXML Document（吸收自 genoffice page-settings.ts 双轨字体与语言防断词设定）
  const doc = new Document({
    title: mainTitleText || 'AI Document',
    creator: 'XC_OmniBox Engine',
    numbering: {
      config: buildNumberingConfig(olInstanceCounter + 4, theme),
    },
    styles: {
      default: {
        document: {
          paragraph: {
            widowControl: true,
          },
          run: {
            font: theme.bodyFont,
            size: theme.bodySize,
            color: theme.bodyColor,
            language: {
              value: 'en-US',
              eastAsia: 'zh-CN',
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 标准尺寸
            margin: theme.pageMargins,
          },
        },
        headers,
        footers,
        children,
      },
    ],
  });

  const docxBuffer = await Packer.toBuffer(doc);
  const cleanTitle = (mainTitleText || '')
    .replace(/[\x00-\x1f\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
    .replace(/[._\s]+$/, '');

  const cleanFileBase = (fileName || '')
    .replace(/\.[^/.]+$/, '')
    .replace(/[\x00-\x1f\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
    .replace(/[._\s]+$/, '');

  const baseName = cleanTitle || cleanFileBase || 'AI_Standard_Document';

  return {
    success: true,
    buffer: docxBuffer,
    filename: `${baseName}.docx`,
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    stats: ast.stats,
    detectedTitle: mainTitleText,
  };
}

module.exports = {
  inspectMarkdown,
  markdownToWord,
};
