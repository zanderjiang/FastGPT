import { PromptTemplateItem } from '../type.d';

export const Prompt_QuoteTemplateList: PromptTemplateItem[] = [
  {
    title: 'Standard Template',
    desc: 'Standard prompt for knowledge bases with flexible structures.',
    value: `{{q}}
{{a}}`
  },
  {
    title: 'QA Template',
    desc: 'Suitable for QA structured knowledge bases, ensuring AI responds strictly according to preset content.',
    value: `<Question>
{{q}}
</Question>
<Answer>
{{a}}
</Answer>`
  },
  {
    title: 'Strict Standard Template',
    desc: 'A more stringent version of the standard template.',
    value: `{{q}}
{{a}}`
  },
  {
    title: 'Strict QA Template',
    desc: 'A more stringent version of the QA template.',
    value: `<Question>
{{q}}
</Question>
<Answer>
{{a}}
</Answer>`
  }
];

export const Prompt_QuotePromptList: PromptTemplateItem[] = [
  {
    title: 'Standard Template',
    desc: '',
    value: `Use the content marked by <Data></Data> as your knowledge:

<Data>
{{quote}}
</Data>

Response Requirements:
- If you are unsure of the answer, you need to clarify.
- Avoid mentioning that you acquired the knowledge from <Data></Data>.
- Keep the answer consistent with the description in <Data></Data>.
- Use Markdown syntax to optimize the format of the response.
- Answer in the same language as the question.

Question:"""{{question}}"""`
  },
  {
    title: 'QA Template',
    desc: '',
    value: `Use the Q&A pairs marked by <QA></QA> to respond.

<QA>
{{quote}}
</QA>

Response Requirements:
- Select one or more Q&A pairs to respond.
- The content of the response should be as consistent as possible with the content in <Answer></Answer>.
- If there are no relevant Q&A pairs, you need to clarify.
- Avoid mentioning that you acquired the knowledge from QA, just provide the answer.

Question:"""{{question}}"""`
  },
  {
    title: 'Strict Standard Template',
    desc: '',
    value: `Forget your existing knowledge, and only use the content marked by <Data></Data> as your knowledge:

<Data>
{{quote}}
</Data>

Thought Process:
1. Determine if the question is related to the content marked by <Data></Data>.
2. If related, answer according to the following requirements.
3. If unrelated, refuse to answer the question.

Response Requirements:
- Avoid mentioning that you acquired the knowledge from <Data></Data>.
- Keep the answer consistent with the description in <Data></Data>.
- Use Markdown syntax to optimize the format of the response.
- Answer in the same language as the question.

Question:"""{{question}}"""`
  },
  {
    title: 'Strict QA Template',
    desc: '',
    value: `Forget your existing knowledge, and only use the Q&A pairs marked by <QA></QA> to respond.

<QA>
{{quote}}
</QA>

Thought Process:
1. Determine if the question is related to the content marked by <QA></QA>.
2. If unrelated, refuse to answer the question.
3. Determine if there are similar or identical questions.
4. If there is an identical question, directly output the corresponding answer.
5. If there are only similar questions, output the similar question and answer together.

Finally, avoid mentioning that you acquired the knowledge from QA, just provide the answer.

Question:"""{{question}}"""`
  }
];
