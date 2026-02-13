/**
 * DOM 选择器配置
 * 
 * 维护指南：
 * - 当 DeepSeek/Gemini 更新页面结构导致插件失效时，请在此文件中修改对应的选择器数组。
 * - 每个数组按优先级从高到低排列，插件会依次尝试直到找到元素。
 * - 新增平台时，在此对象中添加同名键，并补充 messageContainer / userMessage / aiMessage / thinkMessage 数组。
 * 
 * DeepSeek 特殊说明：
 * - DeepSeek 使用动态哈希类名（如 .dad65929, .fa81 等），这些类名会随前端更新而变化
 * - 因此我们采用基于 DOM 结构和语义特征的选择器策略，而非依赖特定哈希类名
 * - 选择器配合 extractor.js 中的智能角色检测逻辑使用
 * 
 * 最后验证：2026-02-13（采用 DOM 结构策略）
 */

/**
 * ⚠️ 重要：使用上下文说明
 * 本文件中所有选择器（userMessage / aiMessage / thinkMessage 数组内的字符串）均设计为：
 *   - 在消息容器元素（msgContainer）上调用 .querySelector(sel) 使用
 *   - 这些选择器应能定位到该消息容器内部的"内容元素"
 *   - 严禁直接用于 document.querySelector 全局查找
 * 
 * 若需新增平台，请确保选择器符合此上下文规则。
 */
export const selectors = {
  // ----- DeepSeek（2026-02-13 采用 DOM 结构策略）-----
  deepseek: {
    // 消息容器：基于 DeepSeek 聊天页面的实际 DOM 结构
    // DeepSeek 的聊天容器是一个包含多个直接子元素的 div，每个子元素代表一条消息
    messageContainer: [
      // 策略1：查找包含 markdown 内容的顶级消息块
      // DeepSeek 消息通常有 .ds-markdown 子元素
      ':has(> :has(.ds-markdown))',
      ':has(.ds-markdown)',
      // 策略2：查找带有特定结构特征的消息块
      ':has([class*="markdown"])',
      // 策略3：基于语义化标签
      'article',
      // 策略4：查找具有思考链特征的消息（AI消息特有）
      ':has([class*="think"])',
      // 策略5：通用消息结构
      '[data-message-id]',
      '[data-testid*="message"]'
    ],

    // 用户消息内容：基于 DOM 结构特征
    // 用户消息通常在消息容器的第一个子元素位置，内容较短，无思考链
    userMessage: [
      // 策略1：直接获取容器的第一个有文本内容的子元素
      ':scope > div:first-child',
      ':scope > div:first-of-type',
      // 策略2：查找不包含 markdown 渲染特征的内容区域
      ':scope > div:not(:has(.ds-markdown))',
      // 策略3：基于文本特征（用户消息通常无代码块、表格等复杂格式）
      ':scope > div:not(:has(pre, table, ul, ol))',
      // 策略4：通用回退
      ':scope > *:first-child'
    ],

    // AI 消息内容：基于 markdown 渲染特征
    // AI 消息通常包含 .ds-markdown 渲染的内容，可能有思考链
    aiMessage: [
      // 策略1：DeepSeek 标准的 markdown 渲染区域
      '.ds-markdown',
      'div.ds-markdown',
      '.ds-markdown.ds-markdown--block',
      // 策略2：通用 markdown 类
      '[class*="markdown"]',
      '.markdown',
      // 策略3：查找包含代码块、表格等复杂格式的内容区域
      ':has(pre, table, ul, ol, h1, h2, h3, h4, h5, h6)',
      // 策略4：带有思考链的消息块中的内容
      ':has(~ [class*="think"]) + div',
      // 策略5：查找较大的内容区域（AI回复通常较长）
      ':scope > div:last-child',
      ':scope > div:last-of-type'
    ],

    // 思考标签：DeepSeek R1 模型的思考过程
    thinkMessage: [
      // 策略1：DeepSeek 思考链特征类
      '[class*="ds-think"]',
      '[class*="think"]',
      // 策略2：查找带有折叠/展开特征的区域
      'details',
      '[class*="collapse"]',
      '[class*="expand"]',
      // 策略3：通用思考类
      '[class*="thought"]',
      '[class*="thinking"]',
      '[class*="reason"]',
      '[class*="reasoning"]'
    ]
  },

  // ----- Gemini（保持原样，无需修改）-----
  gemini: {
    messageContainer: ['user-query', 'message-content'],
    userMessage: ['.query-content', '.query-text-line'],
    aiMessage: ['.markdown.markdown-main-panel'],
    thinkMessage: []
  }
};
