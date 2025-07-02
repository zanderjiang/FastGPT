import { replaceVariable } from '@fastgpt/global/common/string/tools';
import { createChatCompletion } from '../config';
import { ChatItemType } from '@fastgpt/global/core/chat/type';
import { countGptMessagesTokens, countPromptTokens } from '../../../common/string/tiktoken/index';
import { chats2GPTMessages } from '@fastgpt/global/core/chat/adapt';
import { getLLMModel } from '../model';
import { llmCompletionsBodyFormat } from '../utils';
import { addLog } from '../../../common/system/log';
import { filterGPTMessageByMaxContext } from '../../chat/utils';
import json5 from 'json5';

/* 
    query extension - enhancing questions
    Based on context, this can eliminate referential ambiguity and expand questions to improve retrieval.
*/

const title = global.feConfigs?.systemTitle || 'FastAI';
const defaultPrompt = `## Your Task
As a vector retrieval assistant, your task is to combine the conversation history and generate different versions of "search terms" from different angles for the "original question," enhancing the semantic richness and improving the precision of vector retrieval.
The generated questions should have clear and specific objects and be in the "same language as the original question."

## Reference Examples

Conversation history: 
"""
null
"""
Original question: Introduce the plot.
Search terms: ["Describe the story background.", "What is the theme of the story?", "Introduce the main characters of the story."]
----------------
Conversation history: 
"""
user: Conversation background.
assistant: The current conversation is about Nginx introduction and usage.
"""
Original question: How to download
Search terms: ["How to download Nginx?", "What are the requirements for downloading Nginx?", "What channels can I use to download Nginx?"]
----------------
Conversation history: 
"""
user: Conversation background.
assistant: The current conversation is about Nginx introduction and usage.
user: Error "no connection"
assistant: The "no connection" error may be because...
"""
Original question: How to solve it
Search terms: ["How to solve Nginx 'no connection' error?", "Causes of 'no connection' error.", "What to do when Nginx shows 'no connection'?"]
----------------
Conversation history: 
"""
user: How long is the maternity leave?
assistant: The number of days of maternity leave depends on the city in which the employee is located. Please provide your city so that I can answer your questions.
"""
Original question: ShenYang
Search terms: ["How many days is maternity leave in Shenyang?", "Shenyang's maternity leave policy.", "The standard of maternity leave in Shenyang."]
----------------
Conversation history: 
"""
user: Who is the author?
assistant: The author of ${title} is labring.
"""
Original question: Tell me about him
Search terms: ["Introduce labring, the author of ${title}.", "Background information on author labring.", "Why does labring do ${title}?"]
----------------
Conversation history:
"""
user: Conversation background.
assistant: Questions about ${title}'s introduction and usage.
"""
Original question: Hello.
Search terms: ["Hello"]
----------------
Conversation history:
"""
user: How does ${title} charge?
assistant: ${title}'s pricing can be referenced...
"""
Original question: Do you know laf?
Search terms: ["What is laf's official website?", "Tutorials for using laf.", "What are laf's features and advantages?"]
----------------
Conversation history:
"""
user: ${title}'s advantages
assistant: 1. Open source
   2. Simple
   3. Highly extensible
"""
Original question: Introduce the 2nd point.
Search terms: ["Introduce ${title}'s simplicity advantage", "In what ways does ${title} demonstrate simplicity?"]
----------------
Conversation history:
"""
user: What is ${title}?
assistant: ${title} is a RAG platform.
user: What is Laf?
assistant: Laf is a cloud function development platform.
"""
Original question: What's the relationship between them?
Search terms: ["What's the relationship between ${title} and Laf?", "Introduce ${title}", "Introduce Laf"]

## Output Requirements

1. Output format should be a JSON array with each element as a string. No explanation of the output is needed.
2. The output language should match the original question. If the original question is in Chinese, output in Chinese; if in English, output in English.

## Start Task

Conversation history:
"""
{{histories}}
"""
Original question: {{query}}
Search terms: `;

export const queryExtension = async ({
  chatBg,
  query,
  histories = [],
  model
}: {
  chatBg?: string;
  query: string;
  histories: ChatItemType[];
  model: string;
}): Promise<{
  rawQuery: string;
  extensionQueries: string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
}> => {
  const systemFewShot = chatBg
    ? `user: Conversation background.
assistant: ${chatBg}
`
    : '';

  const modelData = getLLMModel(model);
  const filterHistories = await filterGPTMessageByMaxContext({
    messages: chats2GPTMessages({ messages: histories, reserveId: false }),
    maxContext: modelData.maxContext - 1000
  });

  const historyFewShot = filterHistories
    .map((item) => {
      const role = item.role;
      const content = item.content;
      if ((role === 'user' || role === 'assistant') && content) {
        if (typeof content === 'string') {
          return `${role}: ${content}`;
        } else {
          return `${role}: ${content.map((item) => (item.type === 'text' ? item.text : '')).join('\n')}`;
        }
      }
    })
    .filter(Boolean)
    .join('\n');
  const concatFewShot = `${systemFewShot}${historyFewShot}`.trim();

  const messages = [
    {
      role: 'user',
      content: replaceVariable(defaultPrompt, {
        query: `${query}`,
        histories: concatFewShot || 'null'
      })
    }
  ] as any;

  const { response: result } = await createChatCompletion({
    body: llmCompletionsBodyFormat(
      {
        stream: false,
        model: modelData.model,
        temperature: 0.1,
        messages
      },
      modelData
    )
  });

  let answer = result.choices?.[0]?.message?.content || '';
  if (!answer) {
    return {
      rawQuery: query,
      extensionQueries: [],
      model,
      inputTokens: 0,
      outputTokens: 0
    };
  }

  const start = answer.indexOf('[');
  const end = answer.lastIndexOf(']');
  if (start === -1 || end === -1) {
    addLog.warn('Query extension failed, not a valid JSON', {
      answer
    });
    return {
      rawQuery: query,
      extensionQueries: [],
      model,
      inputTokens: 0,
      outputTokens: 0
    };
  }

  // Intercept the content of [] and retain []
  const jsonStr = answer
    .substring(start, end + 1)
    .replace(/(\\n|\\)/g, '')
    .replace(/  /g, '');

  try {
    const queries = json5.parse(jsonStr) as string[];

    return {
      rawQuery: query,
      extensionQueries: (Array.isArray(queries) ? queries : []).slice(0, 5),
      model,
      inputTokens: await countGptMessagesTokens(messages),
      outputTokens: await countPromptTokens(answer)
    };
  } catch (error) {
    addLog.warn('Query extension failed, not a valid JSON', {
      answer
    });
    return {
      rawQuery: query,
      extensionQueries: [],
      model,
      inputTokens: 0,
      outputTokens: 0
    };
  }
};
