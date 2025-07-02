export const Prompt_AgentQA = {
  description: `<Context></Context> tags contain a text passage. Study and analyze it, then organize your learning outcomes:
- Formulate questions and provide answers for each question.
- Answers should be detailed and complete, preserving the original descriptions where possible, with appropriate elaboration.
- Answers can include regular text, links, code, tables, formulas, media links, and other Markdown elements.
- Formulate up to 50 questions.
- Generate questions and answers in the same language as the source text.
`,
  fixedText: `Please organize your learning outcomes in the following format:
<Context>
text
</Context>
Q1: Question.
A1: Answer.
Q2:
A2:

------

Let's begin!

<Context>
{{text}}
</Context>
`
};

export const Prompt_ExtractJson = `You can extract specified JSON information from the <conversation_record></conversation_record>. You only need to return the JSON string, without answering questions.
<extraction_requirements>
{{description}}
</extraction_requirements>

<extraction_rules>
- The JSON string to be extracted must conform to JsonSchema rules.
- 'type' represents the data type; 'key' represents the field name; 'description' represents the field description; 'enum' represents enumeration values, indicating possible values.
- If there is no extractable content, ignore that field.
</extraction_rules>

<JsonSchema>
{{json}}
</JsonSchema>

<conversation_record>
{{text}}
</conversation_record>

Extracted JSON string:`;

export const Prompt_CQJson = `Please help me perform a "question classification" task by categorizing the question into one of the following types:

"""
{{typeList}}
"""

## Background Knowledge
{{systemPrompt}}

## Conversation History
{{history}}

## Starting the Task

Now, let's begin classification. I'll give you a "question," and please categorize it into the corresponding type based on the background knowledge and conversation history, then return the type ID.

Question: "{{question}}"
Type ID=
`;

export const PROMPT_QUESTION_GUIDE = `You are an AI assistant tasked with predicting the user's next question based on the conversation history. Your goal is to generate 3 potential questions that will guide the user to continue the conversation. When generating these questions, adhere to the following rules:

1. Use the same language as the user's last question in the conversation history.
2. Keep each question under 20 characters in length.

Analyze the conversation history provided to you and use it as context to generate relevant and engaging follow-up questions. Your predictions should be logical extensions of the current topic or related areas that the user might be interested in exploring further.

Remember to maintain consistency in tone and style with the existing conversation while providing diverse options for the user to choose from. Your goal is to keep the conversation flowing naturally and help the user delve deeper into the subject matter or explore related topics.`;
export const PROMPT_QUESTION_GUIDE_FOOTER = `Please strictly follow the format rules: \nReturn questions in JSON format: ['Question 1', 'Question 2', 'Question 3']. Your output: `;
