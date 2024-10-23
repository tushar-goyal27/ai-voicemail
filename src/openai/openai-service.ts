import { WebSocket } from "ws";
import { ERealtimeServerEvents, IOpenAiIncomingMessage } from "./types";
import { getOpenAiWebSocket } from "./openai-websocket";
import { convertToPCM16 } from "../audio/audio-helpers";
import { DIGITAL_SEO_PROMPT, SUMMARY_PROMPT } from "./prompts";
import { ETools, TOOLS_DEFINATION_CONFIG } from "./tools";
import { TwilioMessageService } from "../twilio/twilio-message.service";

export class OpenAiService {
  private readonly openAiWs: WebSocket;
  private readonly clientWs: WebSocket;
  private readonly twilioMessageSvc: TwilioMessageService;
  private readonly EXCLUDE_LOGS_FOR_EVENTS = [
    "response.audio.delta",
    "response.audio_transcript.delta",
    "response.text.delta",
  ];

  private streamSid: string;
  private callDetails: { caller: string; called: string };
  private sendSummarySmsTo = process.env.SEND_SUMMARY_SMS_TO;
  private isAiAudioPlaying = false;
  private listenForSummaryGeneration = false;

  constructor(clientWs: WebSocket) {
    this.openAiWs = getOpenAiWebSocket();
    this.clientWs = clientWs;

    this.createEventListeners();
    this.twilioMessageSvc = TwilioMessageService.getInstance();
  }

  private createEventListeners() {
    this.openAiWs.on("open", () => {
      console.log("Connected to OpenAI Realtime.");

      // wait for the openai websocket to be open
      const waitForOpen = async () => {
        while (this.openAiWs.readyState !== WebSocket.OPEN) {
          await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for 0.1 second
        }
      };
      waitForOpen().then(() => {
        this.intializeSession();
        this.promptInitalResponse();
      });
    });

    this.openAiWs.on("message", (message: Buffer) => {
      this.incomingMessageHandler(message.toString());
    });
  }

  sendCallAudio(audio: string) {
    if (this.openAiWs.readyState !== WebSocket.OPEN) return;
    const audioAppend = {
      type: "input_audio_buffer.append",
      audio: audio,
    };
    this.openAiWs.send(JSON.stringify(audioAppend));
  }

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

    // handler for function calls
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

    // for any error from openai, hang up the call
    if (receivedMessage.type === ERealtimeServerEvents.ERROR) {
      this.hangUp(false);
    }

    // send summary of the call in an sms to a predefined number
    if (
      this.listenForSummaryGeneration &&
      receivedMessage.type === ERealtimeServerEvents.RESPONSE_TEXT_DONE
    ) {
      this.listenForSummaryGeneration = false;
      this.twilioMessageSvc.sendSms(
        this.sendSummarySmsTo,
        `Call summary from ${this.callDetails.caller}: ${receivedMessage.text}`
      );
    }
  }

  disconnect() {
    const summaryGenerationItem = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: SUMMARY_PROMPT,
          },
        ],
      },
    };
    this.openAiWs.send(JSON.stringify(summaryGenerationItem));

    // start listening for the summary generation response. The event will be response.text.done
    this.listenForSummaryGeneration = true;

    // prompt openai to generate a response
    this.openAiWs.send(
      JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["text"],
        },
      })
    );

    // wait for the summary generation response
    const waitForSummary = async () => {
      while (this.listenForSummaryGeneration) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
      }
    };
    waitForSummary().then(() => {
      console.log("Disconnecting from OpenAI");
      this.openAiWs.close();
    });
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

  private promptInitalResponse() {
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
  }

  private intializeSession() {
    const sessionUpdate = {
      type: "session.update",
      session: {
        turn_detection: { type: "server_vad" },
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        voice: "alloy",
        instructions: DIGITAL_SEO_PROMPT,
        modalities: ["text", "audio"],
        temperature: 0.8,
        tools: [TOOLS_DEFINATION_CONFIG[ETools.HANG_UP]],
      },
    };
    this.openAiWs.send(JSON.stringify(sessionUpdate));
  }

  setAiAudioPlayingComplete() {
    this.isAiAudioPlaying = false;
  }

  setCallMetadata(
    streamSid: string,
    callDetails: { caller: string; called: string }
  ) {
    this.streamSid = streamSid;
    this.callDetails = callDetails;
  }

  sendUserHangedUpEvent() {
    // send a message to the ai to inform that the user has hung up the call
    const userHangedUpItem = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: "The user has hung up the call.",
          },
        ],
      },
    };
    this.openAiWs.send(JSON.stringify(userHangedUpItem));
  }

  /**
   * @deprecated: Used for testing with m4a audio files only. Not used in production.
   */
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
}
