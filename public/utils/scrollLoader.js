/**
 * 自动滚动加载全部历史对话
 * 策略：逐步滚动到顶部，实时收集已出现的消息元素
 * 
 * DeepSeek 特殊处理：
 * - 由于 DeepSeek 使用动态哈希类名，我们采用基于 DOM 结构的消息检测
 * - 消息检测基于：包含 .ds-markdown 或具有消息结构特征的元素
 * 
 * 最后验证：2026-02-13（采用 DOM 结构策略）
 */

// ========== 静态导入（修复动态加载路径错误）==========
import { selectors } from '../content/selectors';

// 平台对应的滚动容器选择器
const SCROLL_CONTAINER_SELECTORS = {
  // DeepSeek 滚动容器：基于实际页面结构
  deepseek: [
    '.ds-scroll-area',               // DeepSeek 标准滚动区域
    '[class*="scroll"]',             // 包含 scroll 的类
    '[class*="chat"]',               // 包含 chat 的类
    'main',                          // 语义化标签
    '[role="main"]',                 // ARIA 角色
    '.conversation-container',       // 通用对话容器
    'body'                           // 最后回退
  ],
  gemini: [
    'div[role="main"]',
    '.conversation-container',
    'c-wiz'
  ]
};

/**
 * DeepSeek 消息检测函数
 * 由于使用动态类名，需要基于 DOM 结构特征检测消息
 * 
 * 返回值：
 * - { isMessage: true, reason: '...' } - 是消息
 * - { isMessage: false, reason: '...' } - 不是消息，跳过
 * - { isMessage: false, reason: '...', continueSearch: true } - 不是消息，但需要继续向下搜索
 */
function isDeepSeekMessage(element) {
  const text = element.textContent.trim();
  // 安全获取 className（SVG 元素的 className 是 SVGAnimatedString）
  const className = (element.getAttribute && element.getAttribute('class')) || '';
  const tagName = element.tagName.toLowerCase();
  const children = element.children;
  const lowerClassName = className.toLowerCase();
  
  // 排除骨架屏/加载占位符
  if (lowerClassName.includes('skeleton')) {
    return { isMessage: false, reason: '骨架屏占位符' };
  }
  
  // 排除明显的非消息元素
  const excludePatterns = ['input', 'textarea', 'nav', 'header', 'footer', 'form'];
  if (excludePatterns.includes(tagName)) {
    return { isMessage: false, reason: `标签类型 ${tagName}` };
  }
  
  // 排除输入区域相关元素
  const inputPatterns = ['input', 'editor', 'compose', 'send', 'toolbar', 'welcome', 'suggestion', 'prompt', 'gutter', 'sidebar', 'nav', 'menu'];
  for (const pattern of inputPatterns) {
    if (lowerClassName.includes(pattern)) {
      return { isMessage: false, reason: `包含 ${pattern} 类名` };
    }
  }
  
  // 排除过大的元素（可能是整个页面）
  // 提高限制到 500000，允许长 AI 回复
  if (text.length > 500000) {
    return { isMessage: false, reason: '内容过大' };
  }
  
  // 关键：如果有子元素但没有文本，继续向下搜索
  if (children.length > 0 && text.length === 0) {
    return { isMessage: false, reason: '有子元素但无文本，继续向下搜索', continueSearch: true };
  }
  
  // 排除空元素：只有在没有子元素且文本为空时才完全跳过
  if (children.length === 0 && text.length === 0) {
    return { isMessage: false, reason: '空元素（无子元素无文本）' };
  }
  
  // 有实际文本内容的元素（移除最小长度限制，允许短消息）
  if (text.length > 0) {
    return { isMessage: true, reason: `有实际内容（${text.length}字符）` };
  }
  
  return { isMessage: true, reason: '符合基本条件' };
}

/**
 * 检查元素是否可能是消息列表容器
 */
function isMessageListContainer(element) {
  const children = element.children;
  if (children.length < 2) return false;
  
  // 安全获取 className
  const className = (element.getAttribute && element.getAttribute('class')) || '';
  const lowerClassName = className.toLowerCase();
  
  // 排除 gutter 相关元素
  if (lowerClassName.includes('gutter')) {
    return false;
  }
  
  // 如果类名包含 scroll 且不是 gutter，很可能是消息列表容器
  if (lowerClassName.includes('scroll')) {
    return true;
  }
  
  // 如果有多个子元素，检查是否需要继续深入
  return children.length >= 2;
}

/**
 * 从滚动容器中提取 DeepSeek 消息
 * 策略：
 * 1. 遍历滚动容器的直接子元素
 * 2. 如果子元素是消息列表容器，则递归提取其内部消息
 * 3. 如果子元素有内容但没有文本，继续向下搜索
 * 4. 如果子元素是单条消息，则直接收集
 */
function extractDeepSeekMessages(container, depth = 0) {
  const messages = [];
  const directChildren = Array.from(container.children);
  const indent = '  '.repeat(depth);
  
  console.log(`${indent}[AI Exporter] 容器子元素数量: ${directChildren.length}`);
  
  // 遍历每个直接子元素
  directChildren.forEach((child, index) => {
    // 安全获取 className（SVG 元素的 className 是 SVGAnimatedString，不是字符串）
    const className = (child.getAttribute && child.getAttribute('class')) || '';
    const classNameDisplay = className.substring(0, 60);
    const childrenCount = child.children.length;
    const textLength = child.textContent.trim().length;
    console.log(`${indent}[AI Exporter] 检查子元素 ${index}: ${child.tagName}, class="${classNameDisplay}", 子元素数: ${childrenCount}, 文本长度: ${textLength}`);
    
    // 先检查是否是消息列表容器
    if (isMessageListContainer(child)) {
      console.log(`${indent}[AI Exporter] 子元素 ${index} 是消息列表容器，递归提取`);
      const innerMessages = extractDeepSeekMessages(child, depth + 1);
      messages.push(...innerMessages);
      return;
    }
    
    // 检查是否是单条消息
    const result = isDeepSeekMessage(child);
    if (result.isMessage) {
      console.log(`${indent}[AI Exporter] 子元素 ${index} 识别为消息：${result.reason}`);
      messages.push(child);
    } else if (result.continueSearch) {
      // 有子元素但没有文本，继续向下搜索
      console.log(`${indent}[AI Exporter] 子元素 ${index} 需要继续向下搜索：${result.reason}`);
      const innerMessages = extractDeepSeekMessages(child, depth + 1);
      messages.push(...innerMessages);
    } else {
      console.log(`${indent}[AI Exporter] 子元素 ${index} 跳过：${result.reason}`);
    }
  });
  
  return messages;
}

export async function scrollToLoadAllMessages(platform) {
  const START_TIME = Date.now();
  const MAX_TOTAL_TIME = 30000;
  
  console.log(`[AI Exporter] 开始加载消息，平台: ${platform}`);
  console.log(`[AI Exporter] 当前URL: ${location.href}`);

  // DeepSeek 特殊处理：直接查找消息容器
  if (platform === 'deepseek') {
    return await loadDeepSeekMessages();
  }

  // 其他平台：原有逻辑
  const containerSelectors = SCROLL_CONTAINER_SELECTORS[platform] || [];
  let container = null;
  for (const sel of containerSelectors) {
    container = document.querySelector(sel);
    if (container) {
      console.log(`[AI Exporter] 找到滚动容器: ${sel}`);
      break;
    }
  }
  if (!container) {
    console.warn(`[AI Exporter] 未找到滚动容器，平台: ${platform}`);
    return [];
  }

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
      } catch (e) {
        console.warn(`[AI Exporter] 选择器语法错误: ${sel}`);
      }
    }
    
    const uniqueElements = [...new Set(visible)];
    uniqueElements.forEach(el => {
      let key = el.getAttribute('data-message-id') || `el:${el.tagName}:${el.getAttribute('class')}`;
      messageMap.set(key, el);
    });
    
    console.log(`[AI Exporter] 当前收集到 ${messageMap.size} 条消息`);
  }

  collectVisibleMessages();

  let maxAttempts = 30;
  let prevSize = messageMap.size;
  
  while (maxAttempts-- > 0 && (Date.now() - START_TIME) < MAX_TOTAL_TIME) {
    container.scrollTop = 0;
    await new Promise(resolve => setTimeout(resolve, 800));
    collectVisibleMessages();
    
    if (messageMap.size === prevSize && container.scrollTop === 0) {
      break;
    }
    prevSize = messageMap.size;
  }

  const sorted = Array.from(messageMap.values()).sort((a, b) => {
    if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
  
  console.log(`[AI Exporter] 最终收集到 ${sorted.length} 条消息`);
  return sorted;
}

/**
 * DeepSeek 专用：加载所有消息
 * 简化版本：直接使用 extractRenderedMessages
 */
async function loadDeepSeekMessages() {
  console.log(`[AI Exporter] DeepSeek 专用加载模式`);
  
  /**
   * 查找主滚动容器
   */
  function findMainScrollContainer() {
    const candidates = document.querySelectorAll('[class*="scroll-area"]:not([class*="gutter"])');
    
    for (const c of candidates) {
      if (c.scrollHeight > c.clientHeight && c.clientHeight > 100) {
        const className = (c.getAttribute && c.getAttribute('class')) || '';
        console.log(`[AI Exporter] 找到主滚动容器: ${className}`);
        return c;
      }
    }
    return null;
  }

  // 1. 找到主滚动容器
  const scrollContainer = findMainScrollContainer();
  
  // 2. 保存原始滚动位置
  let originalScrollTop = 0;
  
  if (scrollContainer) {
    originalScrollTop = scrollContainer.scrollTop;
    const scrollHeight = scrollContainer.scrollHeight;
    const clientHeight = scrollContainer.clientHeight;
    
    // 只有当滚动高度大于可见高度时才需要滚动加载
    if (scrollHeight > clientHeight + 100) {
      console.log(`[AI Exporter] 需要滚动加载更多消息... 总高度=${scrollHeight}`);
      
      // 快速滚动触发渲染
      scrollContainer.scrollTop = scrollHeight;
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      scrollContainer.scrollTop = 0;
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  }

  // 3. 提取消息（使用简化版本）
  const messages = extractRenderedMessages();
  
  // 4. 恢复原始滚动位置
  if (scrollContainer) {
    scrollContainer.scrollTop = originalScrollTop;
  }
  
  console.log(`[AI Exporter] 最终收集到 ${messages.length} 条消息`);
  return messages;
}

/**
 * 提取已渲染的消息
 */
function extractRenderedMessages() {
  const messages = [];
  const seen = new Set();
  
  // 查找所有可能的消息元素
  const candidates = document.querySelectorAll('[class*="message"], [data-message-id], article, [role="article"]');
  
  for (const candidate of candidates) {
    if (candidate.querySelector('.ds-skeleton, [class*="skeleton"]')) continue;
    
    const text = candidate.textContent.trim();
    // 安全获取 className
    const className = (candidate.getAttribute && candidate.getAttribute('class')) || '';
    const lowerClassName = className.toLowerCase();
    
    // 移除最小长度限制，允许短消息
    if (text.length === 0) continue;
    if (lowerClassName.includes('sidebar') || lowerClassName.includes('nav') || lowerClassName.includes('gutter')) continue;
    
    const key = `${className}:${text.substring(0, 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    
    messages.push(candidate);
    console.log(`[AI Exporter] 识别到消息: ${text.substring(0, 50)}...`);
  }
  
  // 广泛搜索
  if (messages.length === 0) {
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      const text = div.textContent.trim();
      const className = (div.getAttribute && div.getAttribute('class')) || '';
      const lowerClassName = className.toLowerCase();
      
      // 移除最小长度限制，允许短消息
      // 提高最大长度限制到 500000
      if (text.length === 0 || text.length > 500000) continue;
      if (lowerClassName.includes('skeleton') || lowerClassName.includes('sidebar') || lowerClassName.includes('gutter') || lowerClassName.includes('nav')) continue;
      if (div.querySelector('.ds-skeleton, [class*="skeleton"]')) continue;
      if (div.children.length === 0) continue;
      
      const key = `${className}:${text.substring(0, 100)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      
      messages.push(div);
      console.log(`[AI Exporter] 广泛搜索找到: ${text.substring(0, 50)}...`);
    }
  }
  
  // 排序
  messages.sort((a, b) => {
    if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
  
  return messages;
}
