interface ICallCustomParameters {
  caller: string;
  called: string;
}

export interface IStreamStartMessage {
  accountSid: string;
  streamSid: string;
  callSid: string;
  tracks: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mediaFormat: any;
  customParameters: ICallCustomParameters;
}
