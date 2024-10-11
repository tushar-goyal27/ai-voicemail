export enum ERealtimeServerEvents {
  RESPONSE_DONE = "response.done",
  RESPONSE_AUDIO_DELTA = "response.audio.delta",
  RESPONSE_AUDIO_DONE = "response.audio.done",
}

export interface IOpenAiIncomingMessage {
  type: ERealtimeServerEvents;
  response?: {
    output: {
      content: {
        text: string;
      }[];
    }[];
  };
  delta?: string;
}
