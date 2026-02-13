/**
 * AI对话导出插件 - UI模块
 * 
 * 功能：
 * 1. 创建复制/导出按钮
 * 2. 处理按钮点击事件
 * 3. 显示导出菜单（DeepSeek专用）
 * 
 * @file public/content/ui.js
 */

import { detectPlatform } from '../utils/helpers';
import { extractConversation } from './extractor';

/**
 * 创建按钮并插入到页面
 * @returns {boolean} true=成功插入到正确位置，false=使用固定定位
 */
export function createButtons() {
  const platform = detectPlatform();
  
  // 检查按钮是否已存在
  const existing = document.getElementById('ai-exporter-buttons');
  if (existing) {
    if (existing.style.position === 'fixed') {
      existing.remove();
      console.log('[AI Exporter] 移除旧按钮，重新定位');
    } else {
      return true;
    }
  }

  const container = document.createElement('div');
  container.id = 'ai-exporter-buttons';
  container.className = 'ai-exporter-container';

  // 创建复制按钮
  const copyBtn = createButton('copy', platform);
  container.appendChild(copyBtn);

  // DeepSeek 平台添加导出菜单
  if (platform === 'deepseek') {
    const exportWrapper = createExportMenu(platform);
    container.appendChild(exportWrapper);
  } else {
    const exportBtn = createButton('export', platform);
    container.appendChild(exportBtn);
  }

  // 查找插入位置
  const targetEl = findInsertTarget(platform);
  
  if (targetEl) {
    const sendArea = targetEl.querySelector('.bf38813a');
    if (sendArea) {
      targetEl.insertBefore(container, sendArea);
    } else {
      targetEl.insertBefore(container, targetEl.lastElementChild);
    }
    console.log('[AI Exporter] 按钮已插入到正确位置');
    return true;
  } else {
    // 降级：固定在右下角
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '2147483647';
    document.body.appendChild(container);
    console.log('[AI Exporter] 未找到合适位置，使用固定定位');
    return false;
  }
}

/**
 * 创建导出菜单（DeepSeek专用）
 * 提供"直接导出"和"导出思考过程"两个选项
 */
function createExportMenu(platform) {
  const wrapper = document.createElement('div');
  wrapper.className = 'ai-exporter-menu-wrapper';
  
  const btn = document.createElement('button');
  btn.id = 'export-conversation-btn';
  btn.className = 'ai-exporter-btn';
  btn.title = '导出对话';
  btn.innerHTML = exportSVG;
  
  const menu = document.createElement('div');
  menu.className = 'ai-exporter-menu';
  menu.innerHTML = `
    <div class="ai-exporter-menu-item" data-action="export">直接导出</div>
    <div class="ai-exporter-menu-item" data-action="export-with-thinking">导出思考过程</div>
  `;
  
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = btn.getBoundingClientRect();
    menu.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    
    menu.classList.toggle('show');
  });
  
  menu.querySelectorAll('.ai-exporter-menu-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      menu.classList.remove('show');
      
      const includeThinking = item.dataset.action === 'export-with-thinking';
      
      const originalHTML = btn.innerHTML;
      btn.innerHTML = loadingSVG;
      btn.disabled = true;
      
      try {
        const content = await extractConversation(platform, includeThinking);
        if (content) await downloadContent(content);
      } catch (err) {
        console.error('[AI Exporter] 错误:', err);
        showToast('导出失败: ' + err.message, 3000);
      } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
      }
    });
  });
  
  document.addEventListener('click', () => menu.classList.remove('show'));
  
  wrapper.appendChild(btn);
  wrapper.appendChild(menu);
  return wrapper;
}

/**
 * 创建单个按钮
 */
function createButton(type, platform) {
  const btn = document.createElement('button');
  btn.id = type === 'copy' ? 'copy-conversation-btn' : 'export-conversation-btn';
  btn.className = 'ai-exporter-btn';
  btn.title = type === 'copy' ? '复制对话' : '导出文件';
  btn.innerHTML = type === 'copy' ? copySVG : exportSVG;
  
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const originalHTML = btn.innerHTML;
    btn.innerHTML = loadingSVG;
    btn.disabled = true;

    try {
      const content = await extractConversation(platform, false);
      if (!content) return;

      if (type === 'copy') {
        await copyToClipboard(content);
      } else {
        await downloadContent(content);
      }
    } catch (err) {
      console.error('[AI Exporter] 错误:', err);
      showToast('操作失败: ' + err.message, 3000);
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  });

  return btn;
}

/**
 * 下载内容为Markdown文件
 */
async function downloadContent(content) {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(/[\/\s:]/g, '-');
  
  let title = document.title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
  const filename = `${timeStr}_${title}.md`;
  
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * 复制文本到剪贴板
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板', 2000);
  } catch (err) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('已复制到剪贴板', 2000);
  }
}

/**
 * 显示Toast提示
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

/**
 * 查找按钮插入位置
 */
function findInsertTarget(platform) {
  if (platform === 'deepseek') {
    // DeepSeek 输入框区域选择器
    const selectors = ['.ec4f5d61', '.bf38813a', '._77cefa5', '._24fad49'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
  }
  return null;
}

// SVG 图标
const copySVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

const exportSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

const loadingSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></path></svg>`;
