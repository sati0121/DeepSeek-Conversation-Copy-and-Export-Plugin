/**
 * AI对话导出插件 - 内容脚本入口
 * 
 * 功能：
 * 1. 检测当前平台（DeepSeek/Gemini）
 * 2. 创建复制/导出按钮
 * 3. 监听页面变化，重新创建按钮
 * 
 * @file public/content/index.js
 */

import { detectPlatform } from '../utils/helpers';
import { createButtons } from './ui';

// 当前URL，用于检测SPA页面切换
let currentUrl = location.href;

// 按钮创建重试计数
let retryCount = 0;
const MAX_RETRIES = 5;

/**
 * 初始化插件
 */
function init() {
  if (detectPlatform()) {
    createButtonsWithRetry();
    setupObserver();
  }
}

/**
 * 带重试的按钮创建
 * 如果按钮使用了固定定位（降级方案），会自动重试
 */
function createButtonsWithRetry() {
  const success = createButtons();
  
  if (success === false && retryCount < MAX_RETRIES) {
    retryCount++;
    console.log(`[AI Exporter] 按钮位置不正确，${retryCount * 500}ms 后重试...`);
    setTimeout(createButtonsWithRetry, retryCount * 500);
  }
}

/**
 * 设置DOM变化监听器
 * 用于检测SPA页面切换和按钮丢失
 */
let observer;
function setupObserver() {
  if (observer) observer.disconnect();
  
  observer = new MutationObserver(() => {
    // URL变化 = 页面切换
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      retryCount = 0;
      setTimeout(createButtonsWithRetry, 1000);
      return;
    }
    // 按钮丢失 = 需要重新创建
    if (!document.getElementById('ai-exporter-buttons')) {
      retryCount = 0;
      setTimeout(createButtonsWithRetry, 500);
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * URL轮询检测（备用方案）
 * 某些SPA框架的URL变化不会触发MutationObserver
 */
setInterval(() => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    retryCount = 0;
    setTimeout(createButtonsWithRetry, 1000);
  }
}, 1000);

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (observer) observer.disconnect();
});
