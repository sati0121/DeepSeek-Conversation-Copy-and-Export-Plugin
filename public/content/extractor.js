import { selectors } from './selectors';
import { isGeneratingResponse } from '../utils/helpers';
import { scrollToLoadAllMessages } from '../utils/scrollLoader';

/**
 * DeepSeek 角色检测
 * 固定交替模式：偶数索引=用户，奇数索引=AI
 * 这是 DeepSeek 的固定结构
 */
function detectDeepSeekRole(msgContainer, index) {
  const role = (index % 2 === 0) ? '用户' : 'AI';
  return { role, confidence: 1.0 };
}

/**
 * 从 DeepSeek 消息容器提取内容
 */
function extractDeepSeekContent(msgContainer, role) {
  if (role === 'AI') {
    return extractAIAnswer(msgContainer);
  } else {
    // 用户消息：直接返回容器，getTextContent 会处理
    return msgContainer;
  }
}

/**
 * 提取 AI 最终回答（排除思考过程）
 * 关键：只提取 .ds-markdown 元素的内容，不包含"已思考"前缀
 */
function extractAIAnswer(msgContainer) {
  // 查找思考过程容器
  const thinkContent = msgContainer.querySelector('.ds-think-content');
  
  // 查找所有 .ds-markdown 元素
  const allMarkdowns = msgContainer.querySelectorAll('.ds-markdown');
  
  // 找到不在思考过程内的 markdown（这是最终回答）
  for (const md of allMarkdowns) {
    if (thinkContent && thinkContent.contains(md)) {
      // 这个 markdown 在思考过程内，跳过
      continue;
    }
    // 找到了最终回答的 markdown
    return md;
  }
  
  // 如果没有 markdown（比如简短回复 "1"），尝试提取文本
  // 但要排除思考过程区域
  if (thinkContent) {
    // 找思考过程之后的文本
    const thinkParent = thinkContent.parentElement;
    if (thinkParent) {
      const siblings = Array.from(thinkParent.children);
      const thinkIndex = siblings.indexOf(thinkContent);
      for (let i = thinkIndex + 1; i < siblings.length; i++) {
        const sibling = siblings[i];
        const text = sibling.textContent.trim();
        if (text.length > 0 && text.length < 1000) {
          return sibling;
        }
      }
    }
  }
  
  // 如果 AI 消息没有 markdown，直接返回容器
  return msgContainer;
}

/**
 * 从 DeepSeek 消息容器提取思考链
 */
function extractDeepSeekThinking(msgContainer) {
  const thinkEl = msgContainer.querySelector('.ds-think-content');
  
  if (thinkEl) {
    // 只提取思考过程内的 markdown
    const thinkMarkdown = thinkEl.querySelector('.ds-markdown');
    if (thinkMarkdown) {
      return thinkMarkdown;
    }
    return thinkEl;
  }
  
  return null;
}

export async function extractConversation(platform, includeThinking = true) {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const allMessages = await scrollToLoadAllMessages(platform);
  
  if (isGeneratingResponse(platform)) {
    alert('请等待 AI 回复完成后再导出');
    return null;
  }

  if (allMessages.length === 0) {
    alert('当前没有可导出的完整对话');
    return null;
  }

  const platformSelectors = selectors[platform];
  if (!platformSelectors) return null;

  let content = '# AI 对话记录\n\n';
  let extractedCount = 0;
  
  for (let i = 0; i < allMessages.length; i++) {
    const msgContainer = allMessages[i];
    let role = null;
    let contentEl = null;

    if (platform === 'deepseek') {
      const detection = detectDeepSeekRole(msgContainer, i);
      role = detection.role;
      contentEl = extractDeepSeekContent(msgContainer, role);
    }
    else if (platform === 'gemini') {
      if (msgContainer.tagName.toLowerCase() === 'user-query') {
        for (const sel of platformSelectors.userMessage) {
          const el = msgContainer.querySelector(sel);
          if (el) {
            role = '用户';
            contentEl = el;
            break;
          }
        }
      } else if (msgContainer.tagName.toLowerCase() === 'message-content') {
        for (const sel of platformSelectors.aiMessage) {
          const el = msgContainer.querySelector(sel);
          if (el) {
            role = 'AI';
            contentEl = el;
            break;
          }
        }
      }
    }

    if (role && contentEl) {
      const textContent = getTextContent(contentEl);
      if (textContent && textContent.trim().length > 0) {
        let additionalContent = '';
        
        // 只有当 includeThinking 为 true 时才添加思考过程
        if (includeThinking && role === 'AI' && platform === 'deepseek') {
          const thinkEl = extractDeepSeekThinking(msgContainer);
          if (thinkEl) {
            const thinkContent = getTextContent(thinkEl);
            if (thinkContent && thinkContent.trim().length > 0) {
              additionalContent = `\n\n> [思考过程]\n> ${thinkContent.replace(/\n/g, '\n> ')}`;
            }
          }
        }
        else if (includeThinking && role === 'AI' && platformSelectors.thinkMessage) {
          for (const thinkSel of platformSelectors.thinkMessage) {
            const thinkEl = msgContainer.querySelector(thinkSel);
            if (thinkEl) {
              additionalContent += `\n\n> [思考过程] ${getTextContent(thinkEl)}`;
              break;
            }
          }
        }
        
        content += `## ${role}\n\n${textContent}${additionalContent}\n\n---\n\n`;
        extractedCount++;
      }
    }
  }
  
  // 移除末尾多余的 '---\n\n'
  content = content.replace(/\n\n---\n\n$/, '');
  
  if (content.trim() === '# AI 对话记录') {
    alert('无法提取对话内容，请检查页面结构是否变化');
    return null;
  }
  
  return content;
}

// 递归提取带Markdown格式的文本
export function getTextContent(element, indentLevel = 0) {
  let text = '';
  
  element.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // 处理公式（LaTeX）
      if (node.classList && (
          node.classList.contains('math') || 
          node.classList.contains('katex') || 
          node.tagName.toLowerCase() === 'annotation'
        )) {
        let latex = '';
        const annotation = node.querySelector('annotation');
        if (annotation && annotation.textContent.trim()) {
          latex = annotation.textContent.trim();
        } else {
          latex = node.textContent.trim();
        }
        const isDisplay = node.classList.contains('display') || 
                          node.closest('.katex-display') !== null;
        if (isDisplay) {
          text += `\n\n$${latex}$\n\n`;
        } else {
          text += ` $${latex}$ `;
        }
        return;
      }
      
      const tagName = node.tagName.toLowerCase();
      
      if (tagName === 'img') {
        text += '[图片]';
      } else if (tagName === 'code') {
        text += '`' + node.textContent + '`';
      } else if (tagName === 'pre') {
        let langName = 'text';
        const classMatch = node.className.match(/language-(\w+)/);
        if (classMatch) langName = classMatch[1];
        else if (node.getAttribute('lang')) langName = node.getAttribute('lang');
        else if (node.getAttribute('data-language')) langName = node.getAttribute('data-language');
        text += `\n\n\`\`\`${langName}\n${node.textContent}\n\`\`\`\n\n`;
      } else if (tagName === 'rp') {
        return;
      } else if (tagName === 'rt') {
        text += ` (${node.textContent})`;
      } else if (tagName === 'ruby') {
        text += getTextContent(node, indentLevel);
      } else if (tagName === 'table') {
        const rows = node.querySelectorAll('tr');
        rows.forEach((row, rowIndex) => {
          const cells = row.querySelectorAll('th, td');
          const cellTexts = Array.from(cells).map(cell => getTextContent(cell));
          text += '| ' + cellTexts.join(' | ') + ' |\n';
          if (rowIndex === 0) {
            text += '|' + cellTexts.map(() => ' --- ').join('|') + '|\n';
          }
        });
        text += '\n';
      } else if (tagName === 'ul' || tagName === 'ol') {
        const items = node.querySelectorAll(':scope > li');
        items.forEach((li, index) => {
          const prefix = tagName === 'ul' ? '- ' : `${index + 1}. `;
          text += '  '.repeat(indentLevel) + prefix + getTextContent(li, indentLevel + 1) + '\n';
        });
        text += '\n';
      } else if (['strong', 'b'].includes(tagName)) {
        text += `**${getTextContent(node, indentLevel)}**`;
      } else if (['em', 'i'].includes(tagName)) {
        text += `*${getTextContent(node, indentLevel)}*`;
      } else if (tagName === 'a') {
        text += `[${getTextContent(node, indentLevel)}](${node.href})`;
      } else if (tagName.startsWith('h') && tagName.length === 2 && !isNaN(tagName[1])) {
        const level = tagName[1];
        text += '#'.repeat(parseInt(level)) + ' ' + getTextContent(node, indentLevel) + '\n\n';
      } else if (tagName === 'p') {
        text += node.textContent + '\n\n';
      } else if (tagName === 'br') {
        text += '\n';
      } else {
        text += getTextContent(node, indentLevel);
      }
    }
  });
  
  return text.trim();
}
