/** Durable settings namespace for product-wide GUI onboarding facts. */
export const WELCOME_NOTICE_SETTINGS_NAMESPACE = 'ui-onboarding'

/** Field storing the last welcome notice version the user acknowledged. */
export const WELCOME_NOTICE_ACK_FIELD = 'welcomeNoticeVersion'

/**
 * Bump only when the notice changes materially and every user should see it
 * again. The acknowledgement is compared for exact equality.
 */
export const WELCOME_NOTICE_VERSION = '2026-08-14.1'

/** The complete editable internal-testing notice in both supported GUI locales. */
export const WELCOME_NOTICE_COPY = {
  zh: {
    title: '内测声明',
    body: 'Qrush Agent 基于 DeepSeek Harness 的预览版本进行个性化定制，仍处在快速迭代阶段，还有许多地方需要持续改进和打磨，希望听取广大开发者的反馈建议。\n\n我们期待与开发者一起，在开源、开放、可复用、可组合的基础设施之上，把 Qrush 打造成更贴合 DeepSeek 使用体验的 Agent。欢迎加入 Qrush 生态。',
    continueLabel: '继续',
  },
  en: {
    title: 'Internal Testing Notice',
    body: "Qrush Agent is a personalized build on the DeepSeek Harness preview and is still iterating rapidly. Many areas need further improvement, and we welcome feedback from the developer community.\n\nWe look forward to building Qrush into an agent that fits the DeepSeek experience, on open, reusable, and composable infrastructure. Welcome to the Qrush ecosystem.",
    continueLabel: 'Continue',
  },
} as const
