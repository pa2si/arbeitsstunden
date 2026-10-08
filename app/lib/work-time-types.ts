export type TimeBlock = {
  login: string;
  logout: string;
};

export type BreakDetail = {
  label: string;
  amount: number;
  type: 'auto' | 'manual';
};

export type WorkTimeCalculation = {
  numericTargetHours: number;
  remainingMinutes: number;
  expectedEndTime: string;
  lostMinutes: number;
  earlyLoginMinutes: number;
  isActiveShift: boolean;
  workedTime: string;
  remainingTime: string;
  hasOpenBlock: boolean;
  shouldMuteRemainingTime: boolean;
  expectedLegalBreak: number;
  breakBreakdown: BreakDetail[];
  accountedBreak: number;
  hasActivePause: boolean;
  gapDetails: { afterBlock: number; amount: number }[];
  totalManualGaps: number;
  officialWindowFeedback: { label: string; amount: number }[];
};
