import { ChatGPTAPI } from "chatgpt";

export async function converse(
  user: string,
  preamble: string,
  message: string
) {
  const chatGpt = new ChatGPTAPI({
    apiKey: process.env.OPENAI_API_KEY!,
    completionParams: {
      temperature: 0.4,
      top_p: 0.8,
      max_tokens: 2048,
      model: "gpt-3.5-turbo",
      user,
    },
  });

  const response = await chatGpt.sendMessage(message, {
    systemMessage: preamble,
  });

  return response;
}
