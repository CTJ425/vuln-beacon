import type { MessageKey, Messages } from './messages/en';

export type MessageParams = Record<string, string | number>;

export const translate = (messages: Messages, key: MessageKey, params?: MessageParams): string => {
  const template = messages[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
};
