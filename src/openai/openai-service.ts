import { WebSocket } from "ws";
import { AudioDeltaHandler } from "../audio/audio-delta-handler";
import { IOpenAiIncomingMessage } from "./types";
import { getOpenAiWebSocket } from "./openai-websocket";
import { convertToPCM16 } from "../audio/audio-helpers";
import { DIGITAL_SEO_PROMPT } from "./prompts";

export class OpenAiService {
  private readonly audioDeltaHandler: AudioDeltaHandler;
  private readonly openAiWs: WebSocket;
  private readonly clientWs: WebSocket;
  private readonly EXCLUDE_LOGS_FOR_EVENTS = [
    "response.audio.delta",
    "response.audio_transcript.delta",
  ];

  private streamSid: string;
  private callDetails: { caller: string; called: string };

  constructor(clientWs: WebSocket) {
    this.openAiWs = getOpenAiWebSocket();
    this.clientWs = clientWs;
    this.audioDeltaHandler = new AudioDeltaHandler();

    this.createEventListeners();
  }

  private createEventListeners() {
    this.openAiWs.on("open", () => {
      console.log("Connected to OpenAI Realtime.");
      setTimeout(this.sendSessionUpdate, 500);
    });

    this.openAiWs.on("message", (message: Buffer) => {
      this.incomingMessageHandler(message.toString());
    });
  }

  addCallMetadata(
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

  sendSessionUpdate = () => {
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
      },
    };

    console.log("Sending session update:");
    this.openAiWs.send(JSON.stringify(sessionUpdate));
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

    // if (receivedMessage.type === "response.done") {
    //   this.clientWs.send(receivedMessage.response.output[0].content[0].text);
    // }

    if (
      receivedMessage.type === "response.audio.delta" &&
      receivedMessage.delta
    ) {
      // append the delta for later concating of the whole response
      // this.audioDeltaHandler.appendDelta(receivedMessage.delta);

      // // Send base64 encoded audio data to the client for realtime audio
      // this.clientWs.send(Buffer.from(receivedMessage.delta).toString("base64"));

      const audioDelta = {
        event: "media",
        streamSid: this.streamSid,
        media: {
          payload: receivedMessage.delta,
          // payload: Buffer.from(receivedMessage.delta, "base64").toString(
          //   "base64"
          // ),
        },
      };

      this.clientWs.send(JSON.stringify(audioDelta));
    }

    // if (receivedMessage.type === "response.audio.done") {
    //   // create the final wav file from the deltas
    //   const audioBuffer = this.audioDeltaHandler.finalizeWavFromDeltas();

    //   // create a wav file and save in local
    //   fs.writeFile(`test.wav`, Buffer.from(audioBuffer), (err) => {
    //     if (err) {
    //       console.error("Error writing audio file:", err);
    //     } else {
    //       console.log("Audio file saved:", `test.wav`);
    //     }
    //   });
    // }
  }

  disconnect() {
    this.openAiWs.close();
  }
}
