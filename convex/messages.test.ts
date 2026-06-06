import { MAX_MESSAGE_LENGTH, sanitizeMessageText } from './messages';

describe('sanitizeMessageText', () => {
  test('trims surrounding whitespace', () => {
    expect(sanitizeMessageText('  今天镇上有什么新鲜事？\n')).toBe('今天镇上有什么新鲜事？');
  });

  test('rejects empty messages after trimming', () => {
    expect(() => sanitizeMessageText(' \n\t ')).toThrow('Message cannot be empty');
  });

  test('rejects overlong messages', () => {
    expect(() => sanitizeMessageText('x'.repeat(MAX_MESSAGE_LENGTH + 1))).toThrow(
      `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
    );
  });
});
