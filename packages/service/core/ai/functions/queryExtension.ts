import { replaceVariable } from '@fastgpt/global/common/string/tools';
import { getAIApi } from '../config';
import { ChatItemType } from '@fastgpt/global/core/chat/type';
import { countGptMessagesTokens } from '../../../common/string/tiktoken/index';
import { ChatCompletionMessageParam } from '@fastgpt/global/core/ai/type';
import { chatValue2RuntimePrompt } from '@fastgpt/global/core/chat/adapt';

/* 
    query extension - 问题扩展
    可以根据上下文，消除指代性问题以及扩展问题，利于检索。
*/

const defaultPrompt = `As a vector retrieval assistant, your task is to generate different versions of "retrieval terms" for the "original question" from different perspectives, combining historical records to improve the semantic richness and precision of vector retrieval. The generated questions must be clear and specific to the subject, and use the same language as the "original question". For example:
History: 
"""
"""
Original question: Tell me about the engine.
Retrieval terms: ["Describe the engine specifications.", "What is the engine capacity?", "What type of engine does it have?"]
----------------
History: 
"""
Q: Dialogue background.
A: The current dialogue is about the 2024 Toyota Camry's features and specifications.
"""
Original question: What is the fuel efficiency?
Retrieval terms: ["What is the fuel efficiency of the 2024 Toyota Camry?", "How many miles per gallon does the 2024 Toyota Camry get?", "What is the fuel consumption rate of the 2024 Toyota Camry?"]
----------------
History: 
"""
Q: Dialogue background.
A: The current dialogue is about the 2024 Ford Mustang's performance.
Q: What is the horsepower?
A: The 2024 Ford Mustang has a horsepower of 450.
"""
Original question: Tell me more about the performance.
Retrieval terms: ["What are the performance specs of the 2024 Ford Mustang?", "How fast can the 2024 Ford Mustang go?", "What is the 0-60 mph time for the 2024 Ford Mustang?"]
----------------
History: 
"""
Q: How many seats does it have?
A: The car has five seats.
"""
Original question: What about the interior features?
Retrieval terms: ["What are the interior features of the car?", "Describe the cabin features.", "What technology is available inside the car?"]
----------------
History: 
"""
Q: Who is the manufacturer?
A: The manufacturer is Tesla.
"""
Original question: Tell me about the Model 3.
Retrieval terms: ["Describe the specifications of the Tesla Model 3.", "What are the features of the Tesla Model 3?", "What is the range of the Tesla Model 3?"]
----------------
History:
"""
Q: Dialogue background.
A: Introduction and usage questions about electric vehicles.
"""
Original question: Hi there.
Retrieval terms: ["Hi there"]
----------------
History:
"""
Q: How is the maintenance for electric cars?
A: Maintenance for electric cars can be less frequent than for traditional vehicles due to fewer moving parts.
"""
Original question: Do you know about the Model Y?
Retrieval terms: ["What are the specifications of the Tesla Model Y?", "What features does the Tesla Model Y have?", "How does the Tesla Model Y compare to the Model 3?"]
----------------
History:
"""
Q: Advantages of electric vehicles
A: 1. Environmentally friendly
   2. Lower running costs
   3. Quiet operation
"""
Original question: Explain the first advantage.
Retrieval terms: ["Explain how electric vehicles are environmentally friendly", "In what ways are electric vehicles better for the environment?"]
----------------
History:
"""
Q: What is a hybrid car?
A: A hybrid car uses both an internal combustion engine and an electric motor.
Q: What is an all-electric car?
A: An all-electric car runs solely on electric power.
"""
Original question: What is the difference between them?
Retrieval terms: ["What is the difference between hybrid and all-electric cars?", "Describe the differences between hybrid and electric vehicles.", "What are the pros and cons of hybrid vs. electric cars?"]
----------------
History:
"""
{{histories}}
"""
Original question: {{query}}
Retrieval terms: `;

const defaultSchoolPrompt = `As a vector retrieval assistant, your task is to generate different versions of "retrieval terms" for the "original question" from different perspectives, combining historical records to improve the semantic richness and precision of vector retrieval. The generated questions must be clear and specific to the subject, and use the same language as the "original question". For example:
History:
"""
"""
Original question: Tell me about the IT support office.
Retrieval terms: ["Describe the services provided by the IT support office.", "What are the working hours of the IT office?", "How do I contact the university's IT support?"]
History:
"""
Q: Dialogue background.
A: The current dialogue is about university dormitory assignments and housing policies.
"""
Original question: How do I apply for a dorm?
Retrieval terms: ["How do I apply for a dorm at the university?", "What is the dorm application process?", "Where can I submit my dormitory application?"]
History:
"""
Q: Dialogue background.
A: The current dialogue is about university meal plans and dining services.
Q: What are the meal plan options?
A: The university offers several meal plan options, including unlimited access and pay-per-meal plans.
"""
Original question: What are the dining hall hours?
Retrieval terms: ["What are the operating hours of the dining hall?", "When can I use my meal plan in the dining hall?", "What time does the dining hall close on weekends?"]
History:
"""
Q: How do I schedule an appointment with health services?
A: You can schedule an appointment with health services through the university's health portal or by calling their office.
"""
Original question: What services do they offer?
Retrieval terms: ["What services are provided by the university's health center?", "Does the health center offer mental health support?", "What types of medical care are available at the health services?"]
History:
"""
Q: Who is eligible for student insurance?
A: All full-time students are eligible for the university's health insurance plan.
"""
Original question: Tell me more about the insurance plan.
Retrieval terms: ["What are the details of the student health insurance plan?", "What coverage is included in the university's insurance?", "How do I enroll in the student health insurance plan?"]
History:
"""
Q: Dialogue background.
A: Introduction and usage questions about campus IT services and student portal access.
"""
Original question: Hi there.
Retrieval terms: ["Hi there"]
History:
"""
Q: How do I reset my campus portal password?
A: You can reset your campus portal password by visiting the IT office's password reset page or contacting support.
"""
Original question: Do you know how to submit an IT request?
Retrieval terms: ["How do I submit a support request to the IT office?", "What is the process for requesting IT support?", "Where can I report IT issues on campus?"]
History:
"""
Q: What are the benefits of living on-campus?
A: 1. Proximity to classes and campus services
2. Access to campus events and community activities
3. Convenient dining options
"""
Original question: Explain the first benefit.
Retrieval terms: ["Explain how living on-campus provides proximity to classes.", "How is living on-campus more convenient for attending classes?", "What are the advantages of being close to campus services when living on-campus?"]
History:
"""
Q: What is a commuter student?
A: A commuter student is someone who lives off-campus and travels to the university for classes.
Q: What is an on-campus resident?
A: An on-campus resident lives in university-provided housing, such as dormitories or student apartments.
"""
Original question: What is the difference between them?
Retrieval terms: ["What is the difference between a commuter student and an on-campus resident?", "Describe the differences between commuting and living on-campus.", "What are the pros and cons of living on-campus vs. commuting?"]
History:
"""
{{histories}}
"""
Original question: {{query}}
Retrieval terms:`;

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
  tokens: number;
}> => {
  const systemFewShot = chatBg
    ? `Q: 对话背景。
A: ${chatBg}
`
    : '';
  const historyFewShot = histories
    .map((item) => {
      const role = item.obj === 'Human' ? 'Q' : 'A';
      return `${role}: ${chatValue2RuntimePrompt(item.value).text}`;
    })
    .join('\n');
  const concatFewShot = `${systemFewShot}${historyFewShot}`.trim();

  const ai = getAIApi({
    timeout: 480000
  });

  /* change the prompt for different applications */
  const messages = [
    {
      role: 'user',
      content: replaceVariable(defaultSchoolPrompt, {
        query: `${query}`,
        histories: concatFewShot
      })
    }
  ] as ChatCompletionMessageParam[];
  const result = await ai.chat.completions.create({
    model: model,
    temperature: 0.01,
    // @ts-ignore
    messages,
    stream: false
  });

  let answer = result.choices?.[0]?.message?.content || '';
  if (!answer) {
    return {
      rawQuery: query,
      extensionQueries: [],
      model,
      tokens: 0
    };
  }

  answer = answer.replace(/\\"/g, '"');

  try {
    const queries = JSON.parse(answer) as string[];

    return {
      rawQuery: query,
      extensionQueries: Array.isArray(queries) ? queries : [],
      model,
      tokens: await countGptMessagesTokens(messages)
    };
  } catch (error) {
    console.log(error);
    return {
      rawQuery: query,
      extensionQueries: [],
      model,
      tokens: 0
    };
  }
};
