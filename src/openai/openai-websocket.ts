import { WebSocket } from "ws";
import dotenv from "dotenv";
dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openaiRealtimeUrl =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";

export const getOpenAiWebSocket = () => {
  return new WebSocket(openaiRealtimeUrl, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });
};
