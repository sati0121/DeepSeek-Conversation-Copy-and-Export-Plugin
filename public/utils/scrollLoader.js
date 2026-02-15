/**
 * 自动滚动加载全部历史对话
 * 策略：逐步滚动到顶部，实时收集已出现的消息元素
 * 
 * DeepSeek 特殊处理：
 * - 直接使用 .ds-message 选择器
 * 
 * 最后验证：2026-02-15
 */

import { selectors } from '../content/selectors';

const SCROLL_CONTAINER_SELECTORS = {
  deepseek: [
    '.ds-scroll-area',
    '[class*="scroll"]',
    '[class*="chat"]',
    'main',
    '[role="main"]',
    '.conversation-container',
    'body'
  ],
  gemini: [
    'div[role="main"]',
    '.conversation-container',
    'c-wiz'
  ]
};

export async function scrollToLoadAllMessages(platform) {
  if (platform === 'deepseek') {
    return await loadDeepSeekMessages();
  }

  // 其他平台逻辑
  const containerSelectors = SCROLL_CONTAINER_SELECTORS[platform] || [];
  let container = null;
  for (const sel of containerSelectors) {
    container = document.querySelector(sel);
    if (container) break;
  }
  if (!container) return [];

  const platformSelectors = selectors[platform];
  if (!platformSelectors) return [];
  
  const messageSelectors = platformSelectors.messageContainer || [];
  const messageMap = new Map();

  function collectVisibleMessages() {
    let visible = [];
    for (const sel of messageSelectors) {
      try {
        const elements = container.querySelectorAll(sel);
        visible.push(...Array.from(elements));
      } catch (e) {}
    }
    
    const uniqueElements = [...new Set(visible)];
    uniqueElements.forEach(el => {
      let key = el.getAttribute('data-message-id') || `el:${el.tagName}:${el.getAttribute('class')}`;
      messageMap.set(key, el);
    });
  }

  collectVisibleMessages();

  let maxAttempts = 30;
  let prevSize = messageMap.size;
  const MAX_TOTAL_TIME = 30000;
  const START_TIME = Date.now();
  
  while (maxAttempts-- > 0 && (Date.now() - START_TIME) < MAX_TOTAL_TIME) {
    container.scrollTop = 0;
    await new Promise(resolve => setTimeout(resolve, 800));
    collectVisibleMessages();
    
    if (messageMap.size === prevSize && container.scrollTop === 0) break;
    prevSize = messageMap.size;
  }

  const sorted = Array.from(messageMap.values()).sort((a, b) => {
    if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
  
  return sorted;
}

/**
 * DeepSeek 专用：加载所有消息
 */
async function loadDeepSeekMessages() {
  function findMainScrollContainer() {
    const candidates = document.querySelectorAll('[class*="scroll-area"]:not([class*="gutter"])');
    for (const c of candidates) {
      if (c.scrollHeight > c.clientHeight && c.clientHeight > 100) {
        return c;
      }
    }
    return null;
  }

  const scrollContainer = findMainScrollContainer();
  let originalScrollTop = 0;
  
  if (scrollContainer) {
    originalScrollTop = scrollContainer.scrollTop;
    const scrollHeight = scrollContainer.scrollHeight;
    const clientHeight = scrollContainer.clientHeight;
    
    if (scrollHeight > clientHeight + 100) {
      scrollContainer.scrollTop = scrollHeight;
      await new Promise(resolve => requestAnimationFrame(resolve));
      scrollContainer.scrollTop = 0;
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  }

  // 直接使用 .ds-message 选择器
  const messages = Array.from(document.querySelectorAll('.ds-message'));
  
  // 过滤掉骨架屏
  const filteredMessages = messages.filter(msg => {
    if (msg.querySelector('.ds-skeleton, [class*="skeleton"]')) return false;
    const text = msg.textContent.trim();
    return text.length > 0;
  });
  
  // 按 DOM 顺序排序
  filteredMessages.sort((a, b) => {
    if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
  
  if (scrollContainer) {
    scrollContainer.scrollTop = originalScrollTop;
  }
  
  return filteredMessages;
}
