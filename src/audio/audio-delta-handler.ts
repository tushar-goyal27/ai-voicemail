import { AudioUtil } from "./audio.util";

export class AudioDeltaHandler {
  private pcmChunks: ArrayBuffer[] = [];
  private readonly audioUtil: AudioUtil;

  constructor() {
    this.audioUtil = new AudioUtil();
  }

  appendDelta(base64: string) {
    const binaryString = this.audioUtil.base64ToBinary(base64);
    const pcmBuffer = this.audioUtil.binaryStringToArrayBuffer(binaryString);

    // Add the PCM buffer to the chunks array for later concatenation
    this.pcmChunks.push(pcmBuffer);
  }

  finalizeWavFromDeltas(
    numChannels = 1,
    sampleRate = 24000,
    bitsPerSample = 16
  ): ArrayBuffer {
    const concatenatedPCMBuffer = this.concatPCMChunks();

    const wavHeader = this.audioUtil.createWavHeader(
      numChannels,
      sampleRate,
      bitsPerSample,
      concatenatedPCMBuffer.byteLength
    );

    const wavArrayBuffer = this.audioUtil.concatBuffers(
      wavHeader,
      concatenatedPCMBuffer
    );

    return wavArrayBuffer; // This is the final WAV ArrayBuffer
  }

  private concatPCMChunks(): ArrayBuffer {
    let totalLength = 0;
    for (const chunk of this.pcmChunks) {
      totalLength += chunk.byteLength;
    }

    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    return result.buffer;
  }
}
