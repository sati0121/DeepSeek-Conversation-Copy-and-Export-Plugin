import { selectors } from './selectors';
import { isGeneratingResponse } from '../utils/helpers';
import { scrollToLoadAllMessages } from '../utils/scrollLoader';

/**
 * 导出的 Markdown 格式必须严格遵守：
 * 
 * # AI 对话记录
 * 
 * ## 用户
 * [用户提问内容]
 * 
 * ## AI
 * > [思考过程] (如果有)
 * [AI 回答内容]
 * 
 * ---
 * 
 * ## 用户
 * ...
 */

/**
 * DeepSeek 角色检测
 * 简化版：固定交替模式（用户→AI→用户→AI...）
 * DeepSeek 对话永远是用户先问，AI 再答
 */
function detectDeepSeekRole(msgContainer, index) {
  // 固定交替：偶数索引=用户，奇数索引=AI
  // 第1条(index=0)=用户，第2条(index=1)=AI，第3条(index=2)=用户...
  const role = (index % 2 === 0) ? '用户' : 'AI';
  return { role, confidence: 1.0 };
}

/**
 * 从 DeepSeek 消息容器提取内容
 */
function extractDeepSeekContent(msgContainer, role) {
  if (role === 'AI') {
    // AI 消息：提取最终回答（排除思考过程）
    return extractAIAnswer(msgContainer);
  } else {
    // 用户消息：直接返回容器文本
    return msgContainer;
  }
}

/**
 * 提取 AI 最终回答（排除思考过程）
 */
function extractAIAnswer(msgContainer) {
  // 1. 检查是否有思考过程容器
  const thinkContent = msgContainer.querySelector('.ds-think-content');
  
  if (thinkContent) {
    console.log(`[AI Exporter] 发现思考过程，提取最终回答`);
    
    // 查找所有 .ds-markdown，返回不在思考过程内的
    const allMarkdowns = msgContainer.querySelectorAll('.ds-markdown');
    for (const md of allMarkdowns) {
      if (!thinkContent.contains(md)) {
        console.log(`[AI Exporter] 找到最终回答`);
        return md;
      }
    }
    
    // 方法2：查找思考过程的下一个兄弟元素
    const thinkParent = thinkContent.parentElement;
    if (thinkParent) {
      const siblings = Array.from(thinkParent.children);
      const thinkIndex = siblings.indexOf(thinkContent);
      for (let i = thinkIndex + 1; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling.textContent.trim().length > 20) {
          console.log(`[AI Exporter] 使用思考过程后的元素`);
          return sibling;
        }
      }
    }
  }
  
  // 没有思考过程，直接查找 .ds-markdown
  const markdown = msgContainer.querySelector('.ds-markdown');
  if (markdown) {
    console.log(`[AI Exporter] 使用 .ds-markdown`);
    return markdown;
  }
  
  console.log(`[AI Exporter] 回退使用整个容器`);
  return msgContainer;
}

/**
 * 从 DeepSeek 消息容器提取思考链
 */
function extractDeepSeekThinking(msgContainer) {
  // 查找 .ds-think-content（思考过程的主容器）
  const thinkEl = msgContainer.querySelector('.ds-think-content');
  
  if (thinkEl) {
    // 检查内部是否有 .ds-markdown
    const thinkMarkdown = thinkEl.querySelector('.ds-markdown');
    if (thinkMarkdown) {
      console.log(`[AI Exporter] 找到思考链内的 .ds-markdown`);
      return thinkMarkdown;
    }
    
    console.log(`[AI Exporter] 找到思考链元素: .ds-think-content`);
    return thinkEl;
  }
  
  // 备用：查找包含 "思考" 相关类名的元素
  const thinkPatterns = ['think', 'thought', 'thinking'];
  for (const pattern of thinkPatterns) {
    const el = msgContainer.querySelector(`[class*="${pattern}"]`);
    if (el && el.textContent.trim().length > 50) {
      console.log(`[AI Exporter] 找到思考链元素（备用）: ${pattern}`);
      return el;
    }
  }
  
  return null;
}

export async function extractConversation(platform, includeThinking = true) {
  // 短暂延迟，确保页面稳定
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // 自动滚动加载并收集所有历史消息
  const allMessages = await scrollToLoadAllMessages(platform);
  
  if (isGeneratingResponse(platform)) {
    alert('请等待 AI 回复完成后再导出');
    return null;
  }

  // 若无消息，提前返回
  if (allMessages.length === 0) {
    alert('当前没有可导出的完整对话');
    return null;
  }

  console.log(`[AI Exporter] 开始提取 ${allMessages.length} 条消息的内容`);

  // 根据平台选择器筛选消息
  const platformSelectors = selectors[platform];
  if (!platformSelectors) return null;

  // 按 DOM 出现顺序逐条提取，保持原始对话流
  let content = '# AI 对话记录\n\n';
  let lastRole = null; // 记录上一条消息的角色，用于交替验证
  let extractedCount = 0;
  
  for (let i = 0; i < allMessages.length; i++) {
    const msgContainer = allMessages[i];
    let role = null;
    let contentEl = null;

    // ---------- DeepSeek ----------
    if (platform === 'deepseek') {
      // 固定交替模式
      const detection = detectDeepSeekRole(msgContainer, i);
      role = detection.role;
      
      // 提取内容
      contentEl = extractDeepSeekContent(msgContainer, role);
      
      console.log(`[AI Exporter] 消息 ${i}: 角色=${role}, 内容长度=${contentEl ? contentEl.textContent.trim().length : 0}`);
      
      lastRole = role;
    }

    // ---------- Gemini ----------
    else if (platform === 'gemini') {
      // 根据消息容器标签名区分角色
      if (msgContainer.tagName.toLowerCase() === 'user-query') {
        // 用户消息：在容器内查找 .query-content 或 .query-text-line
        for (const sel of platformSelectors.userMessage) {
          const el = msgContainer.querySelector(sel);
          if (el) {
            role = '用户';
            contentEl = el;
            break;
          }
        }
      } else if (msgContainer.tagName.toLowerCase() === 'message-content') {
        // AI 消息：在容器内查找 .markdown.markdown-main-panel
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

    // ---------- 后续处理（思考标签、拼接 Markdown）保持不变 ----------
    if (role && contentEl) {
      // 检查内容是否有效（长度 > 0）
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
        // 其他平台使用选择器提取思考链
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
      } else {
        console.log(`[AI Exporter] 跳过空内容消息`);
      }
    }
  }
  
  console.log(`[AI Exporter] 成功提取 ${extractedCount} 条消息`);
  
  // 移除末尾多余的 '---\n\n'
  content = content.replace(/\n\n---\n\n$/, '');
  
  // 检查是否有有效内容
  if (content.trim() === '# AI 对话记录') {
    alert('无法提取对话内容，请检查页面结构是否变化');
    return null;
  }
  
  return content;
}

// 递归提取带Markdown格式的文本
// 必须完整处理代码块、表格、列表、加粗、链接、思考标签等
// 最后验证：2026-02-12
export function getTextContent(element, indentLevel = 0) {
  let text = '';
  
  element.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // 处理公式（LaTeX）—— 转换为标准 Markdown 公式语法
      if (node.classList && (
          node.classList.contains('math') || 
          node.classList.contains('katex') || 
          node.tagName.toLowerCase() === 'annotation'
        )) {
        // 1. 优先从 annotation 提取纯净 LaTeX 源码
        let latex = '';
        const annotation = node.querySelector('annotation');
        if (annotation && annotation.textContent.trim()) {
          latex = annotation.textContent.trim();
        } else {
          latex = node.textContent.trim();
        }
        // 2. 判断行内/块级公式
        const isDisplay = node.classList.contains('display') || 
                          node.closest('.katex-display') !== null;
        if (isDisplay) {
          text += `\n\n$${latex}$\n\n`;   // 块级：前后空行 + $...$
        } else {
          text += ` $${latex}$ `;           // 行内：前后空格隔离
        }
        return;  // 跳过该节点内其他子节点，防重复
      }
      
      const tagName = node.tagName.toLowerCase();
      
      if (tagName === 'img') {
        text += '[图片]';
      } else if (tagName === 'code') {
        text += '`' + node.textContent + '`';
      } else if (tagName === 'pre') {
        // 按优先级提取语言标识
        let langName = 'text';
        // 1. class="language-xxx"
        const classMatch = node.className.match(/language-(\w+)/);
        if (classMatch) langName = classMatch[1];
        // 2. lang 属性
        else if (node.getAttribute('lang')) langName = node.getAttribute('lang');
        // 3. data-language 属性
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
        const items = node.querySelectorAll(':scope > li'); // 仅直接子 li
        items.forEach((li, index) => {
          const prefix = tagName === 'ul' ? '- ' : `${index + 1}. `;
          text += '  '.repeat(indentLevel) + prefix + getTextContent(li, indentLevel + 1) + '\n';
        });
        text += '\n';
      } else if (['strong', 'b'].includes(tagName)) {
        text += `**${getTextContent(node, indentLevel)}**`;  // 递归
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