import { WebSocket } from "ws";
import { ERealtimeServerEvents, IOpenAiIncomingMessage } from "./types";
import { getOpenAiWebSocket } from "./openai-websocket";
import { convertToPCM16 } from "../audio/audio-helpers";
import { DIGITAL_SEO_PROMPT } from "./prompts";
import { ETools, toolsDefination } from "./tools";

export class OpenAiService {
  private readonly openAiWs: WebSocket;
  private readonly clientWs: WebSocket;
  private readonly EXCLUDE_LOGS_FOR_EVENTS = [
    "response.audio.delta",
    "response.audio_transcript.delta",
  ];

  private streamSid: string;
  private callDetails: { caller: string; called: string };
  private isAiAudioPlaying = false;

  constructor(clientWs: WebSocket) {
    this.openAiWs = getOpenAiWebSocket();
    this.clientWs = clientWs;

    this.createEventListeners();
  }

  private createEventListeners() {
    this.openAiWs.on("open", () => {
      console.log("Connected to OpenAI Realtime.");
      setTimeout(this.intializeSession, 250);
      setTimeout(this.promptInitalResponse, 250);
    });

    this.openAiWs.on("message", (message: Buffer) => {
      this.incomingMessageHandler(message.toString());
    });
  }

  setCallMetadata(
    streamSid: string,
    callDetails: { caller: string; called: string }
  ) {
    this.streamSid = streamSid;
    this.callDetails = callDetails;
  }

  sendAudioAndPromptResponse = async (message: string) => {
    const audioBuffer = await convertToPCM16(message);
    console.log("Audio buffer size", audioBuffer);
    const audioAppend = {
      type: "input_audio_buffer.append",
      audio: audioBuffer.toString("base64"),
    };
    this.openAiWs.send(JSON.stringify(audioAppend));

    // // this is sent to prompt response from openai
    // this.openAiWs.send(JSON.stringify({ type: "response.create" }));
  };

  sendCallAudio = (audio: string) => {
    if (this.openAiWs.readyState !== WebSocket.OPEN) return;
    const audioAppend = {
      type: "input_audio_buffer.append",
      audio: audio,
    };
    this.openAiWs.send(JSON.stringify(audioAppend));
  };

  setAiAudioPlayingComplete = () => {
    this.isAiAudioPlaying = false;
  };

  private intializeSession = () => {
    const sessionUpdate = {
      type: "session.update",
      session: {
        turn_detection: { type: "server_vad" },
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        input_audio_transcription: {
          // enabled: true,
          model: "whisper-1",
        },
        voice: "alloy",
        instructions: DIGITAL_SEO_PROMPT,
        // instructions: SYSTEM_MESSAGE,
        modalities: ["text", "audio"],
        // modalities: ["text"],
        temperature: 0.8,
        tools: [toolsDefination[ETools.HANG_UP]],
      },
    };
    this.openAiWs.send(JSON.stringify(sessionUpdate));
  };

  private promptInitalResponse = () => {
    const initialConversationItem = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Please greet the caller and introduce yourself according to the instructions provided.",
          },
        ],
      },
    };
    this.openAiWs.send(JSON.stringify(initialConversationItem));
    this.openAiWs.send(JSON.stringify({ type: "response.create" }));
  };

  incomingMessageHandler(message: string) {
    const receivedMessage: IOpenAiIncomingMessage = JSON.parse(
      message.toString()
    );

    if (!this.EXCLUDE_LOGS_FOR_EVENTS.includes(receivedMessage.type))
      console.log(
        "Recieved from openai",
        JSON.stringify(receivedMessage, null, 2)
      );

    if (
      receivedMessage.type === ERealtimeServerEvents.RESPONSE_AUDIO_DELTA &&
      receivedMessage.delta
    ) {
      const audioDelta = {
        event: "media",
        streamSid: this.streamSid,
        media: {
          payload: receivedMessage.delta,
        },
      };
      this.isAiAudioPlaying = true;
      this.clientWs.send(JSON.stringify(audioDelta));
    }

    if (receivedMessage.type === ERealtimeServerEvents.RESPONSE_AUDIO_DONE) {
      // sent to twilio to mark the audio as complete. Twilio sends the mark event with same name when the audio has been played completely on the call.
      const markEvent = {
        event: "mark",
        streamSid: this.streamSid,
        mark: {
          name: receivedMessage.item_id,
        },
      };
      this.clientWs.send(JSON.stringify(markEvent));
    }

    if (
      receivedMessage.type === ERealtimeServerEvents.RESPONSE_FUNCTION_CALL_DONE
    ) {
      switch (receivedMessage.name) {
        case ETools.HANG_UP: {
          this.hangUp();
          break;
        }
      }
    }

    if (receivedMessage.type === ERealtimeServerEvents.ERROR) {
      this.hangUp(false);
    }
  }

  disconnect() {
    console.log("OpenAI disconnected");
    this.openAiWs.close();
  }

  hangUp(waitForAiToFinish = true) {
    const waitForAi = async () => {
      if (!waitForAiToFinish) return;
      while (this.isAiAudioPlaying) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
      }
    };

    waitForAi().then(() => {
      console.log("Hanging up the call");
      this.clientWs.close();
    });
  }
}
