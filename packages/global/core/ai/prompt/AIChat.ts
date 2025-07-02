import { PromptTemplateItem } from '../type.d';
import { i18nT } from '../../../../web/i18n/utils';

export const Prompt_QuoteTemplateList: PromptTemplateItem[] = [
  {
    title: i18nT('app:template.standard_template'),
    desc: i18nT('app:template.standard_template_des'),
    value: `{
  "sourceName": "{{source}}",
  "updateTime": "{{updateTime}}",
  "content": "{{q}}\n{{a}}"
}
`
  },
  {
    title: i18nT('app:template.qa_template'),
    desc: i18nT('app:template.qa_template_des'),
    value: `<Question>
{{q}}
</Question>
<Answer>
{{a}}
</Answer>`
  },
  {
    title: i18nT('app:template.standard_strict'),
    desc: i18nT('app:template.standard_strict_des'),
    value: `{
  "sourceName": "{{source}}",
  "updateTime": "{{updateTime}}",
  "content": "{{q}}\n{{a}}"
}
`
  },
  {
    title: i18nT('app:template.hard_strict'),
    desc: i18nT('app:template.hard_strict_des'),
    value: `<Question>
{{q}}
</Question>
<Answer>
{{a}}
</Answer>`
  }
];

export const Prompt_userQuotePromptList: PromptTemplateItem[] = [
  {
    title: i18nT('app:template.standard_template'),
    desc: '',
    value: `Use the content within <Reference></Reference> tags as a reference for this conversation:

<Reference>
{{quote}}
</Reference>

Response requirements:
- If you're unsure of the answer, please clarify.
- Avoid mentioning that you're obtaining knowledge from the <Reference></Reference> section.
- Keep your answers consistent with the descriptions in the <Reference></Reference> section.
- Use Markdown syntax to optimize the response format.
- Answer in the same language as the question.

Question:"""{{question}}"""`
  },
  {
    title: i18nT('app:template.qa_template'),
    desc: '',
    value: `Use the Q&A pairs within <QA></QA> tags to answer.

<QA>
{{quote}}
</QA>

Response requirements:
- Select one or more Q&A pairs to formulate your answer.
- Your response should match the content in the <Answer></Answer> section as closely as possible.
- If there are no relevant Q&A pairs, please clarify this.
- Avoid mentioning that you're retrieving information from QA pairs; simply provide the answer.

Question:"""{{question}}"""`
  },
  {
    title: i18nT('app:template.standard_strict'),
    desc: '',
    value: `Disregard your existing knowledge and use only the content within <Reference></Reference> tags as a reference for this conversation:

<Reference>
{{quote}}
</Reference>

Thinking process:
1. Determine if the question is related to the content within the <Reference></Reference> tags.
2. If it is related, answer according to the requirements below.
3. If it is not related, directly decline to answer the question.

Response requirements:
- Avoid mentioning that you're obtaining knowledge from the <Reference></Reference> section.
- Keep your answers consistent with the descriptions in the <Reference></Reference> section.
- Use Markdown syntax to optimize the response format.
- Answer in the same language as the question.

Question:"""{{question}}"""`
  },
  {
    title: i18nT('app:template.hard_strict'),
    desc: '',
    value: `Disregard your existing knowledge and use only the Q&A pairs within <QA></QA> tags to answer.

<QA>
{{quote}}
</QA>

Thinking process:
1. Determine if the question is related to the content within the <QA></QA> tags.
2. If it is not related, directly decline to answer the question.
3. Determine if there are similar or identical questions.
4. If there is an identical question, directly output the corresponding answer.
5. If there are only similar questions, output both the similar questions and their answers.

Response requirements:
- If there are no relevant Q&A pairs, please clarify this.
- Your response should match the content in the <QA></QA> section as closely as possible.
- Avoid mentioning that you're retrieving information from QA pairs; simply provide the answer.
- Use Markdown syntax to optimize the response format.
- Answer in the same language as the question.

Question:"""{{question}}"""`
  }
];

export const Prompt_systemQuotePromptList: PromptTemplateItem[] = [
  {
    title: i18nT('app:template.standard_template'),
    desc: '',
    value: `Use the content within <Reference></Reference> tags as a reference for this conversation:

<Reference>
{{quote}}
</Reference>

Response requirements:
- If you're unsure of the answer, please clarify.
- Avoid mentioning that you're obtaining knowledge from the <Reference></Reference> section.
- Keep your answers consistent with the descriptions in the <Reference></Reference> section.
- Use Markdown syntax to optimize the response format.
- Answer in the same language as the question.`
  },
  {
    title: i18nT('app:template.qa_template'),
    desc: '',
    value: `Use the Q&A pairs within <QA></QA> tags to answer.

<QA>
{{quote}}
</QA>

Response requirements:
- Select one or more Q&A pairs to formulate your answer.
- Your response should match the content in the <Answer></Answer> section as closely as possible.
- If there are no relevant Q&A pairs, please clarify this.
- Avoid mentioning that you're retrieving information from QA pairs; simply provide the answer.`
  },
  {
    title: i18nT('app:template.standard_strict'),
    desc: '',
    value: `Disregard your existing knowledge and use only the content within <Reference></Reference> tags as a reference for this conversation:

<Reference>
{{quote}}
</Reference>

Thinking process:
1. Determine if the question is related to the content within the <Reference></Reference> tags.
2. If it is related, answer according to the requirements below.
3. If it is not related, directly decline to answer the question.

Response requirements:
- Avoid mentioning that you're obtaining knowledge from the <Reference></Reference> section.
- Keep your answers consistent with the descriptions in the <Reference></Reference> section.
- Use Markdown syntax to optimize the response format.
- Answer in the same language as the question.`
  },
  {
    title: i18nT('app:template.hard_strict'),
    desc: '',
    value: `Disregard your existing knowledge and use only the Q&A pairs within <QA></QA> tags to answer.

<QA>
{{quote}}
</QA>

Thinking process:
1. Determine if the question is related to the content within the <QA></QA> tags.
2. If it is not related, directly decline to answer the question.
3. Determine if there are similar or identical questions.
4. If there is an identical question, directly output the corresponding answer.
5. If there are only similar questions, output both the similar questions and their answers.

Response requirements:
- If there are no relevant Q&A pairs, please clarify this.
- Your response should match the content in the <QA></QA> section as closely as possible.
- Avoid mentioning that you're retrieving information from QA pairs; simply provide the answer.
- Use Markdown syntax to optimize the response format.
- Answer in the same language as the question.`
  }
];

// Document quote prompt
export const Prompt_DocumentQuote = `Use the content within <FilesContent></FilesContent> tags as a reference for this conversation:
<FilesContent>
{{quote}}
</FilesContent>
`;
