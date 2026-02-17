export type WebhookProtocol = 'kakao' | 'telegram';

export interface KakaoWebhookTextPayload {
  version: '2.0';
  template: {
    outputs: Array<{ simpleText: { text: string } }>;
  };
}

export interface TelegramWebhookPayload {
  ok: false;
  error: string;
  code: string;
  details?: string;
}

const WEBHOOK_ERROR_CODES = {
  CONFIG_MISSING: 'WEBHOOK_CONFIG_MISSING',
  INVALID_SIGNATURE: 'WEBHOOK_INVALID_SIGNATURE',
  INVALID_PAYLOAD: 'WEBHOOK_INVALID_PAYLOAD',
  INVALID_INPUT: 'WEBHOOK_INVALID_INPUT',
  INVALID_STATE: 'WEBHOOK_INVALID_STATE',
  INTERNAL_ERROR: 'WEBHOOK_INTERNAL_ERROR',
} as const;

export type WebhookErrorCode =
  (typeof WEBHOOK_ERROR_CODES)[keyof typeof WEBHOOK_ERROR_CODES];

export function buildKakaoTextPayload(message: string): KakaoWebhookTextPayload {
  return {
    version: '2.0',
    template: {
      outputs: [
        {
          simpleText: {
            text: message,
          },
        },
      ],
    },
  };
}

export function buildTelegramErrorPayload(
  message: string,
  code: WebhookErrorCode = WEBHOOK_ERROR_CODES.INTERNAL_ERROR,
  details?: string,
): TelegramWebhookPayload {
  return {
    ok: false,
    error: message,
    code,
    ...(details ? { details } : {}),
  };
}

export function getWebhookErrorCode(code: keyof typeof WEBHOOK_ERROR_CODES): WebhookErrorCode {
  return WEBHOOK_ERROR_CODES[code];
}
