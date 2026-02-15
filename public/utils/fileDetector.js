/**
 * 文件检测模块
 * 
 * 功能：
 * 1. 扫描对话中的文件元素（图片、文档等）
 * 2. 提取文件信息（名称、URL、类型、大小）
 * 
 * DeepSeek 文件结构（根据实际调试）：
 * - 消息容器: class="ds-message" 或带 "ds-message" 的复合类名
 * - 用户文件区: class="_5cadb25" 等
 * - 文件文本格式: "文件名.扩展名" + "类型" + "大小"
 *   例如: "AI对话复制导出插件开发文档.mdMD 33.97KB"
 * 
 * @file public/utils/fileDetector.js
 */

/**
 * 文件类型枚举
 */
export const FileType = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  CODE: 'code',
  UNKNOWN: 'unknown'
};

/**
 * 文件类型图标映射
 */
export const FileIcons = {
  [FileType.IMAGE]: '🖼️',
  [FileType.DOCUMENT]: '📄',
  [FileType.CODE]: '💻',
  [FileType.UNKNOWN]: '📎'
};

/**
 * 文件类型名称映射（DeepSeek 显示的类型）
 */
const FileTypeNames = {
  'PNG': FileType.IMAGE,
  'JPG': FileType.IMAGE,
  'JPEG': FileType.IMAGE,
  'GIF': FileType.IMAGE,
  'WEBP': FileType.IMAGE,
  'SVG': FileType.IMAGE,
  'MD': FileType.DOCUMENT,
  'PDF': FileType.DOCUMENT,
  'DOC': FileType.DOCUMENT,
  'DOCX': FileType.DOCUMENT,
  'TXT': FileType.DOCUMENT,
  'CSV': FileType.DOCUMENT,
  'XLS': FileType.DOCUMENT,
  'XLSX': FileType.DOCUMENT,
  'ZIP': FileType.DOCUMENT,
  'JS': FileType.CODE,
  'TS': FileType.CODE,
  'PY': FileType.CODE,
  'HTML': FileType.CODE,
  'CSS': FileType.CODE,
  'JSON': FileType.CODE
};

/**
 * 根据文件扩展名判断文件类型
 */
function getFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv'];
  const codeExts = ['js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'css', 'html', 'json', 'xml', 'yaml', 'yml'];
  
  if (imageExts.includes(ext)) return FileType.IMAGE;
  if (docExts.includes(ext)) return FileType.DOCUMENT;
  if (codeExts.includes(ext)) return FileType.CODE;
  return FileType.UNKNOWN;
}

/**
 * 解析 DeepSeek 文件文本
 * 格式: "文件名.扩展名类型标记 大小" 紧密连接
 * 例如: "文件.pdfPDF 1.36MB文件.csvCSV 318B"
 * 图片可能没有大小: "image.jpgJPG"
 * 
 * @returns {Array} [{ filename, ext, typeName, size }, ...]
 */
function parseDeepSeekFileText(text) {
  const files = [];
  
  // 扩展名到类型标记的映射
  const extToMarker = {
    // 文档
    'md': 'MD', 'txt': 'TXT', 'pdf': 'PDF', 'doc': 'DOC', 'docx': 'DOCX',
    'xls': 'XLS', 'xlsx': 'XLSX', 'csv': 'CSV', 'zip': 'ZIP',
    // 图片
    'png': 'PNG', 'jpg': 'JPG', 'jpeg': 'JPEG', 'gif': 'GIF', 'webp': 'WEBP', 'svg': 'SVG',
    // 代码文件
    'py': 'PY', 'js': 'JS', 'ts': 'TS', 'html': 'HTML', 'css': 'CSS', 'json': 'JSON',
    'java': 'JAVA', 'c': 'C', 'cpp': 'CPP', 'h': 'H', 'xml': 'XML', 'yaml': 'YAML', 'yml': 'YML',
    'sh': 'SH', 'bat': 'BAT', 'sql': 'SQL', 'rb': 'RB', 'go': 'GO', 'rs': 'RS', 'php': 'PHP'
  };
  
  // 策略：使用分割符来识别文件边界
  // 文件格式：文件名.扩展名 + 类型标记 + 空格 + 大小 + 下一个文件名
  // 关键：每个文件都以 ".扩展名类型标记" 结尾
  
  // 按长度降序
  const extensions = [
    'docx', 'xlsx', 'pptx', 'jpeg', 'webp', 'html', 'yaml',
    'txt', 'md', 'png', 'jpg', 'gif', 'svg', 'pdf', 'doc', 'csv', 'xls', 'zip',
    'py', 'js', 'ts', 'css', 'json', 'cpp', 'xml', 'yml', 'sql', 'bat', 'rb', 'php',
    'c', 'h', 'sh', 'go', 'rs'
  ];
  
  // 找到所有可能的文件结束位置（.扩展名类型标记 大小 或 .扩展名类型标记）
  const fileEnds = [];
  
  for (const ext of extensions) {
    const marker = extToMarker[ext];
    if (!marker) continue;
    
    // 匹配：.扩展名类型标记 + 空格 + 数字大小
    const regexWithSize = new RegExp(`\\.${ext}${marker}\\s+([\\d.]+[KMGT]?B)`, 'gi');
    let match;
    while ((match = regexWithSize.exec(text)) !== null) {
      fileEnds.push({
        endIndex: match.index + match[0].length,
        ext: ext,
        typeName: marker,
        size: match[1],
        matchText: match[0]
      });
    }
    
    // 匹配：.扩展名类型标记（无大小，如 .jpgJPG 后面紧跟其他内容或结束）
    const regexNoSize = new RegExp(`\\.${ext}${marker}(?=[A-Z\\s]|$)`, 'gi');
    while ((match = regexNoSize.exec(text)) !== null) {
      // 检查是否已经被上面匹配过
      const alreadyMatched = fileEnds.some(fe => 
        fe.endIndex === match.index + match[0].length && fe.ext === ext
      );
      if (!alreadyMatched) {
        fileEnds.push({
          endIndex: match.index + match[0].length,
          ext: ext,
          typeName: marker,
          size: null,
          matchText: match[0]
        });
      }
    }
  }
  
  // 按位置排序
  fileEnds.sort((a, b) => a.endIndex - b.endIndex);
  
  // 根据结束位置反推文件名
  let prevEnd = 0;
  for (const fileEnd of fileEnds) {
    // 文件名从上一个文件结束位置开始，到 ".扩展名" 为止
    const searchText = text.substring(prevEnd, fileEnd.endIndex);
    
    // 查找 ".扩展名" 的位置
    const extPattern = new RegExp(`\\.${fileEnd.ext}${fileEnd.typeName}`, 'i');
    const extMatch = searchText.match(extPattern);
    
    if (extMatch) {
      const filename = searchText.substring(0, extMatch.index + 1 + fileEnd.ext.length).trim();
      
      if (filename.length > 0 && filename.length < 200) {
        files.push({
          filename: filename,
          ext: fileEnd.ext,
          typeName: fileEnd.typeName,
          size: fileEnd.size
        });
      }
    }
    
    prevEnd = fileEnd.endIndex;
  }
  
  return files;
}

/**
 * 检测 DeepSeek 用户上传的文件
 * 根据实际 DOM 结构：
 * - 消息容器: ds-message 类
 * - 文件信息区: _5cadb25 类（包含文件名和大小）
 * - 每个文件在 _76cd190 _0004e59 类的 div 中，有 tabindex="0"
 */
function detectDeepSeekFiles(container) {
  const files = [];
  const fileNameCounter = new Map();
  let globalIndex = 0;
  
  const messages = container.querySelectorAll('[class*="ds-message"]');
  
  messages.forEach((msg, msgIdx) => {
    const fileAreas = msg.querySelectorAll('[class*="_5cadb25"]:not([class*="_76cd190"])');
    
    fileAreas.forEach((area, areaIdx) => {
      const text = area.textContent.trim();
      const fileInfos = parseDeepSeekFileText(text);
      
      if (fileInfos.length === 0) return;
      
      const fileElements = area.querySelectorAll('[class*="_76cd190"][tabindex="0"]');
      
      // 如果找不到标准可点击元素，尝试其他选择器
      let clickables = fileElements;
      if (clickables.length === 0) {
        clickables = area.querySelectorAll('[tabindex="0"], [role="button"], button, [class*="file"], [onclick]');
      }
      
      // 如果还是找不到，检查父元素
      if (clickables.length === 0 && area.parentElement) {
        const parentClickables = area.parentElement.querySelectorAll('[tabindex="0"], [role="button"], button');
        if (parentClickables.length > 0) {
          clickables = parentClickables;
        }
      }
      
      // 检查是否支持预览/导出
      const canExport = clickables.length > 0;
      
      fileInfos.forEach((fileInfo, fileIdx) => {
        globalIndex++;
        
        let displayName = fileInfo.filename;
        const baseName = fileInfo.filename;
        
        if (fileNameCounter.has(baseName)) {
          const count = fileNameCounter.get(baseName) + 1;
          fileNameCounter.set(baseName, count);
          const ext = fileInfo.ext;
          const nameWithoutExt = baseName.replace(new RegExp(`\\.${ext}$`, 'i'), '');
          displayName = `${nameWithoutExt}_${count}.${ext}`;
        } else {
          fileNameCounter.set(baseName, 1);
        }
        
        const fileElement = clickables[fileIdx] || area;
        
        files.push({
          id: `file_${globalIndex}_${Date.now()}`,
          url: '',
          filename: displayName,
          originalFilename: fileInfo.filename,
          type: FileTypeNames[fileInfo.typeName] || getFileType(fileInfo.filename),
          size: fileInfo.size,
          element: fileElement,
          needsClick: true,
          canExport: canExport
        });
      });
    });
  });
  
  return files;
}

/**
 * 检测图片文件（通用方法）
 */
function detectImages(container) {
  const files = [];
  
  const excludePatterns = [
    'avatar', 'user-avatar', 'site-icon', 'site_logo', 'favicon', 
    'logo', 'cdn.deepseek.com/site-icons'
  ];
  
  const isExcluded = (str) => {
    if (!str || typeof str !== 'string') return false;
    const lowerStr = str.toLowerCase();
    return excludePatterns.some(p => lowerStr.includes(p.toLowerCase()));
  };
  
  const allImages = container.querySelectorAll('img[src], img[data-src]');
  allImages.forEach(el => {
    const url = el.src || el.dataset.src;
    if (!url || url.startsWith('data:') || isExcluded(url)) return;
    
    let filename = 'image.png';
    try {
      const urlObj = new URL(url);
      filename = urlObj.pathname.split('/').pop() || 'image.png';
    } catch {
      const parts = url.split('/');
      filename = parts[parts.length - 1] || 'image.png';
    }
    
    if (!files.find(f => f.url === url)) {
      files.push({
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url,
        filename,
        type: FileType.IMAGE,
        size: null,
        element: el
      });
    }
  });
  
  return files;
}

/**
 * 扫描整个对话区域，收集所有文件
 * @param {string} platform - 平台名称
 * @returns {Array} 文件列表
 */
export function scanFiles(platform) {
  const container = document.body;
  let files = [];
  
  if (platform === 'deepseek') {
    files = detectDeepSeekFiles(container);
  } else {
    files = detectImages(container);
  }
  
  // 去重
  const uniqueFiles = [];
  const seenIds = new Set();
  
  files.forEach(file => {
    if (!seenIds.has(file.id)) {
      seenIds.add(file.id);
      uniqueFiles.push(file);
    }
  });
  
  return uniqueFiles;
}

/**
 * 获取文件大小（需要异步请求）
 */
export async function fetchFileSize(url) {
  if (!url) return null;
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const size = response.headers.get('content-length');
    return size ? parseInt(size) : null;
  } catch {
    return null;
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (!bytes) return '未知';
  
  // 如果已经是格式化的字符串
  if (typeof bytes === 'string' && bytes.match(/[\d.]+[KMGT]?B/i)) {
    return bytes;
  }
  
  const numBytes = typeof bytes === 'string' ? parseFloat(bytes) : bytes;
  if (isNaN(numBytes)) return '未知';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = numBytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}