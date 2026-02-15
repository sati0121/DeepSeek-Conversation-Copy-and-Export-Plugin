/**
 * 文件导出 UI 模块
 * 
 * 功能：
 * 1. 创建导出文件按钮
 * 2. 显示文件列表弹窗
 * 3. 处理文件选择和批量下载
 * 
 * @file public/utils/fileExportUI.js
 */

import { scanFiles, FileType, FileIcons } from './fileDetector.js';
import { PDFDocument } from 'pdf-lib';

// 文件选择状态
let selectedFiles = new Set();
let fileCache = [];
// 当前筛选类型 (null = 全部)
let currentFilter = null;

/**
 * 获取筛选后的文件列表
 */
function getFilteredFiles() {
  if (!currentFilter) return fileCache;
  return fileCache.filter(f => f.type === currentFilter);
}

/**
 * 获取各类型文件数量统计
 */
function getFileTypeCounts() {
  const counts = { all: fileCache.length };
  for (const type of Object.values(FileType)) {
    counts[type] = fileCache.filter(f => f.type === type).length;
  }
  return counts;
}

/**
 * 创建导出文件按钮
 * @returns {HTMLElement} 按钮元素
 */
export function createFileExportButton() {
  const btn = document.createElement('button');
  btn.id = 'file-export-btn';
  btn.className = 'ai-exporter-btn ai-file-export-btn';
  btn.title = '导出对话内文件';
  btn.innerHTML = fileIconSVG;
  
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showFileModal();
  });
  
  return btn;
}

/**
 * 显示文件选择弹窗
 */
async function showFileModal() {
  const existing = document.getElementById('file-export-modal');
  if (existing) {
    existing.remove();
    return;
  }
  
  const modal = document.createElement('div');
  modal.id = 'file-export-modal';
  modal.className = 'file-export-modal';
  
  modal.innerHTML = `
    <div class="file-export-modal-content">
      <div class="file-export-header">
        <h3>导出对话内文件</h3>
        <button class="file-export-close" title="关闭">&times;</button>
      </div>
      <div class="file-export-body">
        <div class="file-export-loading">正在扫描文件...</div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.file-export-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  
  fileCache = scanFiles('deepseek');
  updateModalContent(modal, fileCache);
}

/**
 * 更新弹窗内容
 */
function updateModalContent(modal, files) {
  const body = modal.querySelector('.file-export-body');
  
  if (files.length === 0) {
    body.innerHTML = `
      <div class="file-export-empty">
        <div class="file-export-empty-icon">📭</div>
        <p>未检测到文件</p>
        <p class="file-export-empty-hint">当前对话中没有可识别的图片或文档</p>
      </div>
    `;
    return;
  }
  
  // 重置筛选状态
  currentFilter = null;
  
  const counts = getFileTypeCounts();
  const filteredFiles = getFilteredFiles();
  const exportableFiles = filteredFiles.filter(f => f.canExport !== false);
  const notExportableFiles = filteredFiles.filter(f => f.canExport === false);
  
  // 生成筛选标签
  const filterTabs = `
    <div class="file-export-filter-tabs">
      <button class="file-export-filter-tab ${currentFilter === null ? 'active' : ''}" data-filter="all">
        📁 全部 <span class="filter-count">${counts.all}</span>
      </button>
      ${counts[FileType.IMAGE] > 0 ? `
        <button class="file-export-filter-tab ${currentFilter === FileType.IMAGE ? 'active' : ''}" data-filter="${FileType.IMAGE}">
          🖼️ 图片 <span class="filter-count">${counts[FileType.IMAGE]}</span>
        </button>
      ` : ''}
      ${counts[FileType.DOCUMENT] > 0 ? `
        <button class="file-export-filter-tab ${currentFilter === FileType.DOCUMENT ? 'active' : ''}" data-filter="${FileType.DOCUMENT}">
          📄 文档 <span class="filter-count">${counts[FileType.DOCUMENT]}</span>
        </button>
      ` : ''}
      ${counts[FileType.CODE] > 0 ? `
        <button class="file-export-filter-tab ${currentFilter === FileType.CODE ? 'active' : ''}" data-filter="${FileType.CODE}">
          💻 代码 <span class="filter-count">${counts[FileType.CODE]}</span>
        </button>
      ` : ''}
    </div>
  `;
  
  body.innerHTML = `
    ${filterTabs}
    <div class="file-export-toolbar">
      <label class="file-export-select-all">
        <input type="checkbox" id="file-select-all">
        <span>全选</span>
      </label>
      <span class="file-export-count">共 ${filteredFiles.length} 个文件 (${exportableFiles.length} 可导出${notExportableFiles.length > 0 ? `, ${notExportableFiles.length} 不支持` : ''})</span>
    </div>
    <div class="file-export-list">
      ${renderFileList(filteredFiles)}
    </div>
    <div class="file-export-footer">
      <button class="file-export-cancel">取消</button>
      <button class="file-export-download" disabled>
        导出选中 (<span id="selected-count">0</span>)
      </button>
    </div>
  `;
  
  bindModalEvents(modal, filteredFiles);
  bindFilterEvents(modal);
}

/**
 * 渲染文件列表
 */
function renderFileList(files) {
  return files.map((file, index) => `
    <div class="file-export-item ${file.canExport === false ? 'file-export-item-disabled' : ''}" data-id="${file.id}" data-index="${index}">
      <input type="checkbox" class="file-checkbox" data-id="${file.id}" ${file.canExport === false ? 'disabled' : ''}>
      <div class="file-icon">${FileIcons[file.type]}</div>
      <div class="file-info">
        <div class="file-name" title="${file.filename}">${file.filename}</div>
        <div class="file-meta">
          <span class="file-type">${file.type}</span>
          <span class="file-size">${file.size || '大小未知'}${file.canExport === false ? ' ⚠️ 不支持导出' : ''}</span>
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * 绑定筛选标签事件
 */
function bindFilterEvents(modal) {
  const filterTabs = modal.querySelectorAll('.file-export-filter-tab');
  
  filterTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const filter = tab.dataset.filter;
      currentFilter = filter === 'all' ? null : filter;
      
      // 更新标签激活状态
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // 更新文件列表
      refreshFileList(modal);
    });
  });
}

/**
 * 刷新文件列表（筛选后）
 */
function refreshFileList(modal) {
  const filteredFiles = getFilteredFiles();
  const exportableFiles = filteredFiles.filter(f => f.canExport !== false);
  const notExportableFiles = filteredFiles.filter(f => f.canExport === false);
  
  // 更新列表
  const listEl = modal.querySelector('.file-export-list');
  listEl.innerHTML = renderFileList(filteredFiles);
  
  // 更新统计
  const countEl = modal.querySelector('.file-export-count');
  countEl.textContent = `共 ${filteredFiles.length} 个文件 (${exportableFiles.length} 可导出${notExportableFiles.length > 0 ? `, ${notExportableFiles.length} 不支持` : ''})`;
  
  // 重新绑定文件项事件
  bindFileItemEvents(modal, filteredFiles);
  
  // 更新全选状态
  const selectAllCheckbox = modal.querySelector('#file-select-all');
  selectAllCheckbox.checked = false;
  
  // 更新选中数量
  updateSelectedCount(modal);
}

/**
 * 绑定弹窗事件
 */
function bindModalEvents(modal, files) {
  const selectAllCheckbox = modal.querySelector('#file-select-all');
  
  selectAllCheckbox.addEventListener('change', (e) => {
    // 只选择当前筛选列表中的可导出文件
    const filteredFiles = getFilteredFiles();
    const exportableFiltered = filteredFiles.filter(f => f.canExport !== false);
    
    exportableFiltered.forEach(file => {
      if (e.target.checked) {
        selectedFiles.add(file.id);
      } else {
        selectedFiles.delete(file.id);
      }
    });
    
    // 更新当前列表中的复选框状态
    modal.querySelectorAll('.file-checkbox').forEach(cb => {
      const file = filteredFiles.find(f => f.id === cb.dataset.id);
      if (file && file.canExport !== false) {
        cb.checked = e.target.checked;
      }
    });
    
    updateSelectedCount(modal);
  });
  
  // 绑定文件项事件
  bindFileItemEvents(modal, files);
  
  modal.querySelector('.file-export-cancel').addEventListener('click', () => modal.remove());
  
  modal.querySelector('.file-export-download').addEventListener('click', async () => {
    // 从所有文件中筛选已选中的
    const selected = fileCache.filter(f => selectedFiles.has(f.id));
    if (selected.length === 0) return;
    await downloadFiles(selected, modal);
  });
}

/**
 * 绑定文件项事件
 */
function bindFileItemEvents(modal, files) {
  const selectAllCheckbox = modal.querySelector('#file-select-all');
  
  modal.querySelectorAll('.file-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedFiles.add(e.target.dataset.id);
      } else {
        selectedFiles.delete(e.target.dataset.id);
      }
      updateSelectedCount(modal);
      
      // 更新全选状态（基于当前筛选列表）
      const filteredFiles = getFilteredFiles();
      const exportableFiltered = filteredFiles.filter(f => f.canExport !== false);
      const selectedInFilter = exportableFiltered.filter(f => selectedFiles.has(f.id));
      
      selectAllCheckbox.checked = selectedInFilter.length === exportableFiltered.length && exportableFiltered.length > 0;
      selectAllCheckbox.indeterminate = selectedInFilter.length > 0 && selectedInFilter.length < exportableFiltered.length;
    });
  });
  
  modal.querySelectorAll('.file-export-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.type === 'checkbox') return;
      const cb = item.querySelector('.file-checkbox');
      if (!cb.disabled) {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      }
    });
  });
}

/**
 * 更新选中数量
 */
function updateSelectedCount(modal) {
  const countEl = modal.querySelector('#selected-count');
  const downloadBtn = modal.querySelector('.file-export-download');
  countEl.textContent = selectedFiles.size;
  downloadBtn.disabled = selectedFiles.size === 0;
}

/**
 * 下载选中的文件（优化错误处理）
 */
async function downloadFiles(files, modal) {
  const downloadBtn = modal.querySelector('.file-export-download');
  const body = modal.querySelector('.file-export-body');
  
  const exportableFiles = files.filter(f => f.canExport !== false);
  const skippedFiles = files.filter(f => f.canExport === false);
  
  if (exportableFiles.length === 0) {
    showToast('所选文件均不支持导出', 3000);
    modal.remove();
    return;
  }
  
  downloadBtn.disabled = true;
  downloadBtn.innerHTML = `准备下载...`;
  
  const results = {
    success: [],
    failed: [],
    skipped: skippedFiles.map(f => f.filename)
  };
  
  for (let i = 0; i < exportableFiles.length; i++) {
    const file = exportableFiles[i];
    downloadBtn.innerHTML = `下载中 (${i + 1}/${exportableFiles.length}): ${file.filename.substring(0, 20)}...`;
    
    try {
      await downloadSingleFile(file);
      results.success.push(file.filename);
      // 标记成功
      markFileStatus(body, file.id, 'success');
    } catch (err) {
      results.failed.push({ name: file.filename, error: err.message || '未知错误' });
      // 标记失败
      markFileStatus(body, file.id, 'failed');
    }
    
    if (i < exportableFiles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  // 显示结果
  showDownloadResult(modal, results);
}

/**
 * 标记文件状态
 */
function markFileStatus(body, fileId, status) {
  const item = body.querySelector(`[data-id="${fileId}"]`);
  if (!item) return;
  
  const statusEl = item.querySelector('.file-status') || document.createElement('span');
  statusEl.className = 'file-status';
  
  if (status === 'success') {
    statusEl.textContent = ' ✅';
    statusEl.style.color = '#4caf50';
  } else if (status === 'failed') {
    statusEl.textContent = ' ❌';
    statusEl.style.color = '#f44336';
  }
  
  const meta = item.querySelector('.file-meta');
  if (meta && !meta.contains(statusEl)) {
    meta.appendChild(statusEl);
  }
}

/**
 * 显示下载结果
 */
function showDownloadResult(modal, results) {
  const footer = modal.querySelector('.file-export-footer');
  const downloadBtn = modal.querySelector('.file-export-download');
  
  const total = results.success.length + results.failed.length + results.skipped.length;
  let summary = `完成！成功 ${results.success.length}`;
  
  if (results.failed.length > 0) {
    summary += `，失败 ${results.failed.length}`;
  }
  if (results.skipped.length > 0) {
    summary += `，跳过 ${results.skipped.length}`;
  }
  
  downloadBtn.innerHTML = summary;
  downloadBtn.disabled = true;
  
  // 如果有失败，显示详情
  if (results.failed.length > 0) {
    const detailBtn = document.createElement('button');
    detailBtn.className = 'file-export-cancel';
    detailBtn.style.marginLeft = '8px';
    detailBtn.textContent = '查看失败';
    detailBtn.onclick = () => {
      const failedList = results.failed.map(f => `• ${f.name}\n  原因: ${f.error}`).join('\n\n');
      alert(`以下文件导出失败：\n\n${failedList}`);
    };
    footer.appendChild(detailBtn);
  }
  
  // 自动关闭
  setTimeout(() => {
    modal.remove();
    showToast(summary, 4000);
  }, results.failed.length > 0 ? 3000 : 1500);
}

/**
 * 从预览侧边栏提取文本
 */
function extractTextFromSidebar(sidebar) {
  try {
    const urlPatterns = [
      /https?:\/\/[^\s"'<>]+deepseek[^\s"'<>]+/gi,
      /https?:\/\/[^\s"'<>]+\.pdf[^\s"'<>]*/gi,
      /https?:\/\/[^\s"'<>]+obs\.cn-[^\s"'<>]+/gi,
      /https?:\/\/[^\s"'<>]+myhuaweicloud\.com[^\s"'<>]*/gi
    ];
    
    for (const pattern of urlPatterns) {
      const matches = sidebar.outerHTML?.match(pattern);
      if (matches && matches.length > 0) {
        for (const url of matches) {
          let cleanUrl = url.replace(/&amp;/g, '&').replace(/["'>]/g, '');
          if (cleanUrl.includes('file') || cleanUrl.includes('pdf') || cleanUrl.includes('response-content-disposition') || cleanUrl.includes('myhuaweicloud')) {
            return { text: null, fileUrl: cleanUrl };
          }
        }
      }
    }
    
    const canvas = sidebar.querySelector('canvas');
    if (canvas) {
      if (canvas.width > 0 && canvas.height > 0) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          if (dataUrl && dataUrl.length > 100) {
            return { text: null, fileUrl: dataUrl, isCanvasImage: true };
          }
        } catch (e) {
          // Canvas 可能被污染（跨域），忽略此错误
        }
      }
      return { text: null, fileUrl: null, isCanvas: true };
    }
    
    const preElements = sidebar.querySelectorAll('pre, code');
    for (const pre of preElements) {
      const text = pre.textContent || pre.innerText;
      if (text && text.length > 10) return { text, fileUrl: null };
    }
    
    const textSelectors = ['[class*="content"]', '[class*="text"]', '[class*="preview"]', '[class*="viewer"]', '[class*="markdown"]', '[class*="code-block"]', '[class*="abbe3c45"]', 'article', '.prose', 'table', 'pre'];
    for (const selector of textSelectors) {
      const elements = sidebar.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent || el.innerText;
        if (text && text.length > 10) return { text, fileUrl: null };
      }
    }
    
    const fullText = sidebar.textContent || sidebar.innerText;
    if (fullText && fullText.length > 10) return { text: fullText.trim(), fileUrl: null };
    
    return { text: null, fileUrl: null };
  } catch (err) {
    // 侧边栏 DOM 操作可能失败，返回空结果
    return { text: null, fileUrl: null, error: err.message };
  }
}

/**
 * 从侧边栏提取图片
 */
function extractImageFromSidebar(sidebar) {
  const imgSelectors = ['img[src]', 'img[data-src]', '[style*="background-image"]'];
  for (const selector of imgSelectors) {
    const elements = sidebar.querySelectorAll(selector);
    for (const el of elements) {
      let imgUrl = null;
      if (el.tagName === 'IMG') {
        imgUrl = el.src || el.dataset.src;
      } else {
        const style = el.style.backgroundImage;
        const match = style.match(/url\(['"]?(.+?)['"]?\)/);
        if (match) imgUrl = match[1];
      }
      if (imgUrl && (imgUrl.startsWith('http') || imgUrl.startsWith('blob:') || imgUrl.startsWith('data:'))) {
        return imgUrl;
      }
    }
  }
  return null;
}

/**
 * 获取 PDF 预览器信息
 */
function getPdfViewerInfo(sidebar) {
  const pageSpan = sidebar.querySelector('span._608a995');
  let totalPages = 1;
  if (pageSpan) {
    const match = pageSpan.textContent.match(/\/\s*(\d+)/);
    if (match) totalPages = parseInt(match[1]);
  }
  const canvases = sidebar.querySelectorAll('canvas');
  return { totalPages, canvases };
}

/**
 * 导出 PDF 所有页面
 */
async function exportPdfAllPages(sidebar, filename, progressCallback) {
  const info = getPdfViewerInfo(sidebar);
  
  if (!info.canvases || info.canvases.length === 0) {
    throw new Error('PDF 内容未加载，请等待预览加载完成');
  }
  
  const pdfDoc = await PDFDocument.create();
  const baseName = filename.replace(/\.pdf$/i, '');
  let exportedCount = 0;
  const failedPages = [];
  
  for (let i = 0; i < info.canvases.length; i++) {
    const canvas = info.canvases[i];
    if (progressCallback) progressCallback(i + 1, info.canvases.length);
    
    if (canvas.width === 0 || canvas.height === 0) {
      failedPages.push(i + 1);
      continue;
    }
    
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const pngImage = await pdfDoc.embedPng(imageBytes);
      const page = pdfDoc.addPage([canvas.width, canvas.height]);
      page.drawImage(pngImage, { x: 0, y: 0, width: canvas.width, height: canvas.height });
      exportedCount++;
    } catch (err) {
      failedPages.push(i + 1);
    }
  }
  
  if (exportedCount === 0) {
    throw new Error(`PDF 页面渲染失败，共 ${info.canvases.length} 页全部失败`);
  }
  
  const pdfBytes = await pdfDoc.save();
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
  const pdfUrl = URL.createObjectURL(pdfBlob);
  
  const a = document.createElement('a');
  a.href = pdfUrl;
  a.download = `${baseName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
  
  const result = { totalPages: info.canvases.length, exportedPages: exportedCount };
  if (failedPages.length > 0) {
    result.warning = `第 ${failedPages.slice(0, 5).join(', ')}${failedPages.length > 5 ? '...' : ''} 页导出失败`;
  }
  return result;
}

/**
 * 下载文本
 */
function downloadTextAsBlob(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/**
 * 下载单个文件
 */
async function downloadSingleFile(file) {
  return new Promise((resolve, reject) => {
    if (file.needsClick && file.element) {
      try {
        const element = file.element;
        const sidebarSelector = '[class*="_519be07"], [class*="_27fc06b"], [aria-hidden="false"]';
        const imagePreviewSelector = '[class*="modal"], [class*="overlay"], [class*="preview"], [class*="lightbox"], [class*="viewer"], [class*="image"], [role="dialog"], [aria-modal="true"]';
        
        const existingSidebar = document.querySelector(sidebarSelector + '[aria-hidden="false"]');
        if (existingSidebar) {
          const closeBtn = existingSidebar.querySelector('[class*="_5d271a3"], [class*="close"], [aria-label*="close"]');
          if (closeBtn) {
            closeBtn.click();
          } else {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
          }
        }
        
        setTimeout(() => proceedWithDownload(), 500);
        
        async function proceedWithDownload() {
          const sidebarsBefore = document.querySelectorAll(sidebarSelector);
          const previewsBefore = document.querySelectorAll(imagePreviewSelector);
          
          element.click();
          
          const isPdf = file.filename.toLowerCase().endsWith('.pdf');
          const waitTime = isPdf ? 3500 : 2000;
          
          setTimeout(async () => {
            const sidebarsAfter = document.querySelectorAll(sidebarSelector);
            const previewsAfter = document.querySelectorAll(imagePreviewSelector);
            const newSidebars = Array.from(sidebarsAfter).filter(s => !Array.from(sidebarsBefore).includes(s));
            const newPreviews = Array.from(previewsAfter).filter(p => !Array.from(previewsBefore).includes(p));
            
            const isImage = file.type === FileType.IMAGE || /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(file.filename);
            
            if (isImage) {
              for (const preview of [...newPreviews, ...Array.from(previewsAfter)]) {
                const imgUrl = extractImageFromSidebar(preview);
                if (imgUrl) return downloadImageByUrl(imgUrl, file.filename).then(resolve).catch((err) => reject(new Error(`图片下载失败: ${err.message || '网络错误'}`)));
              }
              for (const sidebar of newSidebars) {
                const imgUrl = extractImageFromSidebar(sidebar);
                if (imgUrl) return downloadImageByUrl(imgUrl, file.filename).then(resolve).catch((err) => reject(new Error(`图片下载失败: ${err.message || '网络错误'}`)));
              }
              return reject(new Error('预览窗口未找到图片内容，可能文件未加载完成'));
            }
            
            for (const sidebar of [...newSidebars, ...Array.from(sidebarsAfter)]) {
              const result = extractTextFromSidebar(sidebar);
              const pdfInfo = getPdfViewerInfo(sidebar);
              const isPdfPreview = pdfInfo.canvases && pdfInfo.canvases.length > 0;
              
              if (isPdfPreview && isPdf) {
                try {
                  await exportPdfAllPages(sidebar, file.filename);
                  return resolve();
                } catch (err) {
                  return reject(new Error(`PDF 导出失败: ${err.message || '渲染错误'}`));
                }
              }
              
              if (result.isCanvasImage && result.fileUrl) {
                return downloadImageByUrl(result.fileUrl, file.filename.replace(/\.pdf$/i, '.png')).then(resolve).catch((err) => reject(new Error(`Canvas 导出失败: ${err.message || '转换错误'}`)));
              }
              
              if (result.isCanvas) {
                await new Promise(r => setTimeout(r, 1000));
                const retryResult = extractTextFromSidebar(sidebar);
                if (retryResult.isCanvasImage && retryResult.fileUrl) {
                  return downloadImageByUrl(retryResult.fileUrl, file.filename.replace(/\.pdf$/i, '.png')).then(resolve).catch((err) => reject(new Error(`Canvas 导出失败: ${err.message || '转换错误'}`)));
                }
                continue;
              }
              
              if (result.fileUrl) {
                return downloadImageByUrl(result.fileUrl, file.filename).then(resolve).catch((err) => reject(new Error(`文件下载失败: ${err.message || '网络错误'}`)));
              }
              
              if (result.text) {
                downloadTextAsBlob(result.text, file.filename);
                return resolve();
              }
            }
            
            reject(new Error('无法获取文件内容，预览窗口未正确打开或内容未加载'));
          }, waitTime);
        }
      } catch (err) {
        reject(new Error(`操作异常: ${err.message || '未知错误'}`));
      }
      return;
    }
    
    if (file.url) {
      return chrome.runtime.sendMessage({ type: 'DOWNLOAD_FILE_WITH_NAME', url: file.url, filename: file.filename }, (response) => {
        if (response && response.success) resolve();
        else reject(new Error(`下载失败: ${response?.error || '浏览器下载错误'}`));
      });
    }
    
    reject(new Error('无可用的下载方式，文件缺少有效的 URL 或可点击元素'));
  });
}

/**
 * 通过 URL 下载
 */
function downloadImageByUrl(imgUrl, filename) {
  return new Promise((resolve, reject) => {
    if (imgUrl.startsWith('data:')) {
      try {
        const a = document.createElement('a');
        a.href = imgUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        resolve();
      } catch (e) {
        reject(new Error(`Data URL 下载失败: ${e.message || '浏览器不支持'}`));
      }
      return;
    }
    
    chrome.runtime.sendMessage({ type: 'DOWNLOAD_FILE_WITH_NAME', url: imgUrl, filename: filename }, (response) => {
      if (response && response.success) {
        resolve();
      } else {
        const errorMsg = response?.error || '浏览器下载 API 错误';
        reject(new Error(errorMsg));
      }
    });
  });
}

/**
 * 显示 Toast
 */
function showToast(message, duration = 2000) {
  const existing = document.querySelector('.ai-exporter-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'ai-exporter-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), duration);
}

const fileIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`;