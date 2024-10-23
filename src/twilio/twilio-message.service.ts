import twilio from "twilio";

export class TwilioMessageService {
  private static instance: TwilioMessageService;
  private readonly client: twilio.Twilio;
  private readonly defaultFromNumber: string = process.env.DEFAULT_FROM_NUMBER;

  private constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
    }

    this.client = twilio(accountSid, authToken);
  }

  public static getInstance(): TwilioMessageService {
    if (!TwilioMessageService.instance) {
      TwilioMessageService.instance = new TwilioMessageService();
    }
    return TwilioMessageService.instance;
  }

  async sendSms(to: string, body: string, from?: string) {
    const message = await this.client.messages.create({
      to,
      from: from ?? this.defaultFromNumber,
      body,
    });

    console.log("Message sent: ", message);
  }
}
