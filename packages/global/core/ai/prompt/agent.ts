export const Prompt_AgentQA = {
  description: `<Context></Context> tags a segment of text. Learn and analyze it, and organize the learning outcomes:
- Ask questions and provide answers for each question.
- Answers need to be detailed and complete, retaining the original description as much as possible.
- Answers can include Markdown elements such as plain text, links, code, tables, formulas, media links, etc.
- Ask up to 30 questions.
`,
  fixedText: `Please organize the learning outcomes in the following format:
<Context>
Text
</Context>
Q1: Question.
A1: Answer.
Q2:
A2:

------

Let's start!

<Context>
{{text}}
<Context/>
`
};

export const Prompt_ExtractJson = `You can extract the specified Json information from <conversation></conversation>, you only need to return the Json string, no need to answer questions.
<Extraction Request>
{{description}}
</Extraction Request>

<Extraction Rules>
- The extracted json string should comply with JsonSchema rules.
- type represents the data type; key represents the field name; description represents the field description; enum is the enumeration value, representing the optional value.
- If there is no content to extract, ignore the field.
</Extraction Rules>

<JsonSchema>
{{json}}
</JsonSchema>

<conversation>
{{text}}
</conversation>

Extracted json string:`;

export const Prompt_CQJson = `Please help me perform a "question classification" task by categorizing the question into one of the following types:

"""
{{typeList}}
"""

## Background Knowledge
{{systemPrompt}}

## Conversation History
{{history}}

## Start Task

Now, let's start classification. I will give you a "question", please combine the background knowledge and conversation history to classify the question into the corresponding type and return the type ID.

Question: "{{question}}"
Type ID=
`;
