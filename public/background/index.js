/**
 * AI对话导出插件 - 后台脚本
 * 
 * 功能：
 * 处理来自内容脚本的下载请求
 * 使用Chrome Downloads API保存文件
 * 
 * @file public/background/index.js
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[AI Exporter] 后台收到消息:', request.type);
  
  if (request.type === 'DOWNLOAD_FILE') {
    handleDownload(request.content, request.title, sendResponse);
    return true; // 异步响应
  }
  
  sendResponse({ success: false, error: '未知消息类型' });
  return false;
});

/**
 * 处理文件下载
 * @param {string} content - 文件内容
 * @param {string} title - 页面标题（用于文件名）
 * @param {Function} sendResponse - 响应回调
 */
function handleDownload(content, title, sendResponse) {
  // 生成文件名：时间戳_标题.md
  const timestamp = new Date().toISOString().replace(/[-T:.]/g, '').slice(0, 12);
  let safeTitle = (title || 'conversation')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim() || 'conversation';
  safeTitle = safeTitle.slice(0, 80);
  const filename = `${timestamp}_${safeTitle}.md`;

  console.log('[AI Exporter] 下载文件:', filename);

  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({
    url,
    filename: `AI Conversations/${filename}`,
    saveAs: false
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('[AI Exporter] 下载失败:', chrome.runtime.lastError.message);
      // 使用简单文件名重试
      retryDownload(url, sendResponse);
    } else {
      console.log('[AI Exporter] 下载成功, ID:', downloadId);
      sendResponse({ success: true });
      URL.revokeObjectURL(url);
    }
  });
}

/**
 * 重试下载（使用简单文件名）
 */
function retryDownload(url, sendResponse) {
  const timestamp = new Date().toISOString().replace(/[-T:.]/g, '').slice(0, 12);
  const filename = `${timestamp}_AI_Export.md`;
  
  chrome.downloads.download({
    url,
    filename: `AI Conversations/${filename}`,
    saveAs: false
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('[AI Exporter] 重试下载失败:', chrome.runtime.lastError.message);
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      console.log('[AI Exporter] 重试下载成功, ID:', downloadId);
      sendResponse({ success: true });
    }
    URL.revokeObjectURL(url);
  });
}
