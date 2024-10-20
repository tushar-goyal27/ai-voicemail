export enum ETools {
  HANG_UP = "hang_up",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toolsDefination: Record<ETools, any> = {
  [ETools.HANG_UP]: {
    type: "function",
    name: ETools.HANG_UP,
    description:
      "This function hangs up the call and should be called when the call needs to be ended either by the caller or by the AI",
  },
};
