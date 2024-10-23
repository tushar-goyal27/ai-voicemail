export enum ERealtimeServerEvents {
  ERROR = "error",
  RESPONSE_DONE = "response.done",
  RESPONSE_AUDIO_DELTA = "response.audio.delta",
  RESPONSE_AUDIO_DONE = "response.audio.done",
  RESPONSE_FUNCTION_CALL_DONE = "response.function_call_arguments.done",
  RESPONSE_TEXT_DONE = "response.text.done",
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
  item_id?: string;
  delta?: string;
  name?: string; // for RESPONSE_FUNCTION_CALL_DONE
  arguments?: string; // for RESPONSE_FUNCTION_CALL_DONE
  text?: string; // for RESPONSE_TEXT_DONE
}
