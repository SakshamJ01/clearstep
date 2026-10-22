const CRISIS_PATTERNS: RegExp[] = [
  /\bkill(?:ing)?\s+myself\b/i,
  /\b(?:end|ending)\s+my\s+life\b/i,
  /\b(?:want|wanna|plan|planning|going)\s+to\s+die\b/i,
  /\b(?:better\s+off)\s+(?:dead|without\s+me)\b/i,
  /\b(?:hurt|harm|cut|cutting)\s+myself\b/i,
  /\bself[-\s]?harm\b/i,
  /\bsuicide\b/i,
  /\bsuicidal\s+(?:thoughts?|ideation|feelings?|urges?|plans?)\b/i,
  /\b(?:i(?:'m| am| have been|'ve been)|feel|feeling)\s+(?:so\s+|really\s+|very\s+|quite\s+)?suicidal\b/i,
  /\bno\s+reason\s+to\s+(?:live|go\s+on)\b/i,
  /\bi\s+(?:want|plan|am\s+going)\s+to\s+(?:kill|hurt)\s+(?:someone|him|her|them)\b/i,
];

export const CRISIS_SUPPORT_MESSAGE =
  "Some of what you wrote sounds like you may be in serious distress. Clearstep is not the right kind of support for this moment, so planning is paused and nothing new was generated.";

export const CRISIS_SUPPORT_DETAIL =
  "If you are in immediate danger, contact your local emergency number now. In the US, you can call or text 988. Outside the US, findahelpline.com lists local crisis lines. Reaching out to someone you trust is also worth doing now. Your text is still here and has not been sent to an AI provider.";

export function containsCrisisLanguage(dump: string): boolean {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(dump));
}

export const SENSITIVE_TOPIC_NOTE =
  "If this plan touches health, legal, money, or safety decisions, use it only to organize your own next steps. It is not professional advice.";
