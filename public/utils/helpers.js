// 防抖函数，防止DOM频繁变动时重复执行
// 最后验证：2026-02-12
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 等待单个元素出现（带超时）
// 最后验证：2026-02-12
export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

// 等待多个元素出现（可传入多个选择器，返回所有匹配的元素）
// 最后验证：2026-02-12
export function waitForMultipleElements(selectors, timeout = 5000) {
  const promises = selectors.map(selector => 
    new Promise((resolve) => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        resolve(Array.from(elements));
        return;
      }

      const observer = new MutationObserver(() => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          resolve(Array.from(elements));
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve([]); // 超时返回空数组
      }, timeout);
    })
  );

  return Promise.all(promises).then(results => results.flat());
}

// 检测当前平台
// 最后验证：2026-02-12
export function detectPlatform() {
  if (location.hostname.includes('deepseek')) return 'deepseek';
  if (location.hostname.includes('gemini.google.com') || location.hostname.includes('bard.google.com')) return 'gemini';
  return null;
}

// 检查AI是否正在生成回复
// 最后验证：2026-02-13
export function isGeneratingResponse(platform) {
  if (platform === 'gemini') {
    // Gemini：检测停止生成按钮
    if (document.querySelector('div[aria-label="Stop generating"]')) return true;
  } else if (platform === 'deepseek') {
    // DeepSeek：只检测明确的"停止生成"按钮
    // 这是唯一可靠的生成中指示器
    const stopButton = document.querySelector('button[aria-label="Stop generating"], button[aria-label="停止生成"]');
    if (stopButton) {
      console.log('[AI Exporter] 检测到 AI 正在生成回复');
      return true;
    }
    
    // 检查是否有正在流式输出的内容（消息末尾有光标动画）
    const streamingCursor = document.querySelector('.ds-markdown + .cursor, [class*="cursor"].streaming');
    if (streamingCursor) {
      const style = window.getComputedStyle(streamingCursor);
      if (style.visibility !== 'hidden' && style.display !== 'none') {
        console.log('[AI Exporter] 检测到流式输出中');
        return true;
      }
    }
  }
  return false;
}

// 从多个选择器中找到第一个可用的选择器，并返回其匹配的所有元素
// 最后验证：2026-02-12
export async function findAllAvailableElements(selectors) {
  for (const selector of selectors) {
    try {
      const elements = await waitForMultipleElements([selector], 3000);
      if (elements.length > 0) {
        return elements;
      }
    } catch (e) {
      continue;
    }
  }
  return [];
}