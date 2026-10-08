import { describe, expect, test } from 'bun:test';
import type { Hooks, PluginInput } from '@opencode-ai/plugin';
import PromptImproverPlugin from './index.ts';

type ChatOutput = Parameters<NonNullable<Hooks['chat.message']>>[1];

function message(texts: string[]): ChatOutput {
  return {
    message: {
      id: 'message',
      sessionID: 'test',
      role: 'user',
      time: { created: 0 },
      agent: 'test',
      model: { providerID: 'test', modelID: 'test' },
    },
    parts: texts.map((text, index) => ({
      id: String(index),
      sessionID: 'test',
      messageID: 'message',
      type: 'text',
      text,
    })),
  };
}

const hooks = await PromptImproverPlugin({} as PluginInput);
const context = {
  sessionID: 'test',
  messageID: 'message',
  agent: 'test',
  abort: new globalThis.AbortController().signal,
};

describe('prompt evaluation tools', () => {
  test('vague prompts return a bounded score and concrete suggestions', async () => {
    const result = JSON.parse(
      await hooks.tool!.evaluate_prompt.execute({ prompt: 'make it better' }, context)
    );
    expect(result.isVague).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThan(60);
    expect(result.suggestions).toContain('Mention the specific file or function to work on');
  });

  test('specific requests proceed without clarification', async () => {
    const result = JSON.parse(
      await hooks.tool!.improve_prompt.execute(
        { prompt: 'refactor function LoginForm to use validation that must reject empty fields' },
        context
      )
    );
    expect(result.status).toBe('clear');
    expect(result.score).toBe(100);
  });

  test('vague requests retain the original text in the clarification context', async () => {
    const result = await hooks.tool!.improve_prompt.execute({ prompt: 'make it better' }, context);
    expect(result).toContain('Original Prompt:** "make it better"');
    expect(result).toContain('Wait for User Response');
  });
});

describe('chat integration', () => {
  test.each(['* make it better', '/improve this', '# improve this', '! improve this', 'hi'])(
    'bypasses explicit command or short input: %s',
    async (prompt) => {
      const output = message([prompt]);
      await hooks['chat.message']!({ sessionID: 'test' }, output);
      expect(output).toEqual(message([prompt]));
    }
  );

  test('adds context only to the final text part and preserves previous parts', async () => {
    const output = message(['make', 'it better']);
    await hooks['chat.message']!({ sessionID: 'test' }, output);
    expect(output.parts[0]).toEqual(message(['make']).parts[0]);
    expect(output.parts[1]).toMatchObject({
      text: expect.stringContaining('Original Prompt:** "make\nit better"'),
    });
    expect(output.parts).toHaveLength(2);
  });

  test('clear input and messages without text remain unchanged', async () => {
    for (const texts of [[], ['build all packages and test them']]) {
      const output = message(texts);
      await hooks['chat.message']!({ sessionID: 'test' }, output);
      expect(output).toEqual(message(texts));
    }
  });
});
