import type {
  BreakDetail,
  TimeBlock,
  WorkTimeCalculation,
} from './work-time-types';

const DAY_MINUTES = 24 * 60;
const WORK_START_MINUTES = 6 * 60;
const WORK_END_MINUTES = 21 * 60;

export function timeToMinutes(time: string | null): number | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTimeString(minutes: number): string {
  const isNegative = minutes < 0;
  const absoluteMinutes = Math.abs(minutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const remainingMinutes = absoluteMinutes % 60;
  return `${isNegative ? '-' : ''}${hours}h ${remainingMinutes}m`;
}

function getOverlapWithDailyWindow(
  start: number,
  end: number,
  windowStartOffset: number,
  windowEndOffset: number,
): number {
  if (end <= start) return 0;

  let total = 0;
  const firstDay = Math.floor(start / DAY_MINUTES);
  const lastDay = Math.floor((end - 1) / DAY_MINUTES);

  for (let day = firstDay; day <= lastDay; day++) {
    const windowStart = day * DAY_MINUTES + windowStartOffset;
    const windowEnd = day * DAY_MINUTES + windowEndOffset;
    const overlapStart = Math.max(start, windowStart);
    const overlapEnd = Math.min(end, windowEnd);
    if (overlapEnd > overlapStart) {
      total += overlapEnd - overlapStart;
    }
  }

  return total;
}

function calculateWorkTime(
  timeBlocks: TimeBlock[],
  targetHours: number | string,
  now: Date,
): WorkTimeCalculation {
  const currentMinutesNow = now.getHours() * 60 + now.getMinutes();

  const getOverlapWithOfficialWindow = (start: number, end: number) =>
    getOverlapWithDailyWindow(start, end, WORK_START_MINUTES, WORK_END_MINUTES);

  const alignCurrentToBlock = (blockStartAbsolute: number): number => {
    let alignedNow = currentMinutesNow;
    while (alignedNow < blockStartAbsolute) {
      alignedNow += DAY_MINUTES;
    }

    if (alignedNow - blockStartAbsolute > 36 * 60) {
      return blockStartAbsolute + 36 * 60;
    }

    return alignedNow;
  };

  // Projects the end time within the daily window of the start day; minutes beyond the window end are lost.
  const addMinutesInsideOfficialWindow = (
    startAbsoluteMinutes: number,
    minutesToAdd: number,
  ): { endAbsolute: number; lostMinutes: number } => {
    const dayBase =
      Math.floor(startAbsoluteMinutes / DAY_MINUTES) * DAY_MINUTES;
    const windowStart = dayBase + WORK_START_MINUTES;
    const windowEnd = dayBase + WORK_END_MINUTES;
    const cursor = Math.min(
      Math.max(startAbsoluteMinutes, windowStart),
      windowEnd,
    );
    const availableToday = windowEnd - cursor;

    return {
      endAbsolute: cursor + Math.min(minutesToAdd, availableToday),
      lostMinutes: Math.max(0, minutesToAdd - availableToday),
    };
  };

  const validBlocks = timeBlocks
    .map((block) => ({
      inMinutes: timeToMinutes(block.login),
      outMinutes: timeToMinutes(block.logout),
      hasOut: block.logout !== '',
    }))
    .filter(
      (
        block,
      ): block is {
        inMinutes: number;
        outMinutes: number | null;
        hasOut: boolean;
      } => block.inMinutes !== null,
    )
    .reduce<
      {
        inAbsolute: number;
        outAbsolute: number | null;
        hasOut: boolean;
        countedDuration: number;
      }[]
    >((acc, block) => {
      const lastInAbsolute =
        acc.length > 0 ? acc[acc.length - 1].inAbsolute : null;
      let inAbsolute = block.inMinutes;

      if (lastInAbsolute !== null) {
        while (inAbsolute < lastInAbsolute) {
          inAbsolute += DAY_MINUTES;
        }
      }

      let outAbsolute: number | null = null;
      if (block.hasOut && block.outMinutes !== null) {
        outAbsolute = block.outMinutes;
        while (outAbsolute < inAbsolute) {
          outAbsolute += DAY_MINUTES;
        }
      }

      const blockEndAbsolute = outAbsolute ?? alignCurrentToBlock(inAbsolute);
      const countedDuration = getOverlapWithOfficialWindow(
        inAbsolute,
        blockEndAbsolute,
      );

      acc.push({
        inAbsolute,
        outAbsolute,
        hasOut: block.hasOut,
        countedDuration,
      });

      return acc;
    }, []);

  let totalManualGaps = 0;
  const gapDetails: { afterBlock: number; amount: number }[] = [];

  for (let i = 0; i < validBlocks.length - 1; i++) {
    const block = validBlocks[i];
    const nextBlock = validBlocks[i + 1];
    if (block.hasOut && block.outAbsolute !== null) {
      const gap = getOverlapWithOfficialWindow(
        block.outAbsolute,
        nextBlock.inAbsolute,
      );
      if (gap > 0) {
        totalManualGaps += gap;
        gapDetails.push({ afterBlock: i + 1, amount: gap });
      }
    }
  }

  let effectiveWorked = 0;
  let totalBreakRecognized = totalManualGaps;
  const autoDetails: { inBlock: number; amount: number }[] = [];

  for (let i = 0; i < validBlocks.length; i++) {
    const block = validBlocks[i];
    let blockAutoDeduction = 0;
    let remainingDuration = block.countedDuration;

    const firstSegment = Math.max(
      0,
      Math.min(remainingDuration, 360 - effectiveWorked),
    );
    effectiveWorked += firstSegment;
    remainingDuration -= firstSegment;

    if (effectiveWorked === 360 && remainingDuration > 0) {
      const shortfall = Math.max(0, 30 - totalBreakRecognized);
      const deduction = Math.min(remainingDuration, shortfall);
      blockAutoDeduction += deduction;
      totalBreakRecognized += deduction;
      remainingDuration -= deduction;
    }

    const secondSegment = Math.max(
      0,
      Math.min(remainingDuration, 540 - effectiveWorked),
    );
    effectiveWorked += secondSegment;
    remainingDuration -= secondSegment;

    if (effectiveWorked === 540 && remainingDuration > 0) {
      const shortfall = Math.max(0, 45 - totalBreakRecognized);
      const deduction = Math.min(remainingDuration, shortfall);
      blockAutoDeduction += deduction;
      totalBreakRecognized += deduction;
      remainingDuration -= deduction;
    }

    effectiveWorked += remainingDuration;

    if (blockAutoDeduction > 0) {
      autoDetails.push({ inBlock: i + 1, amount: blockAutoDeduction });
    }
  }

  const numericTargetHours = Number(targetHours) || 0;
  const targetMinutes = numericTargetHours * 60;
  const remainingMinutes = Math.max(0, targetMinutes - effectiveWorked);

  let expectedLegalBreak = 0;
  if (effectiveWorked >= 540 || targetMinutes > 540) {
    expectedLegalBreak = 45;
  } else if (effectiveWorked >= 360 || targetMinutes > 360) {
    expectedLegalBreak = 30;
  }

  let remainingLoggedInTime = 0;
  if (targetMinutes > effectiveWorked) {
    let simulatedEffective = effectiveWorked;
    let simulatedBreakRecognized = totalBreakRecognized;

    while (simulatedEffective < targetMinutes) {
      remainingLoggedInTime++;

      if (simulatedEffective === 360 && simulatedBreakRecognized < 30) {
        simulatedBreakRecognized++;
      } else if (simulatedEffective === 540 && simulatedBreakRecognized < 45) {
        simulatedBreakRecognized++;
      } else {
        simulatedEffective++;
      }
    }
  }

  let expectedEndTime = '--:--';
  let lostMinutes = 0;
  let isActiveShift = false;

  if (
    validBlocks.length > 0 &&
    remainingMinutes > 0 &&
    numericTargetHours > 0
  ) {
    const lastBlock = validBlocks[validBlocks.length - 1];
    let projection: { endAbsolute: number; lostMinutes: number };

    if (lastBlock.hasOut && lastBlock.outAbsolute !== null) {
      projection = addMinutesInsideOfficialWindow(
        lastBlock.outAbsolute,
        remainingLoggedInTime,
      );
    } else {
      const currentAligned = alignCurrentToBlock(lastBlock.inAbsolute);
      projection = addMinutesInsideOfficialWindow(
        currentAligned,
        remainingLoggedInTime,
      );
      isActiveShift = true;
    }

    const expectedEndAbsolute = projection.endAbsolute;
    lostMinutes = projection.lostMinutes;

    const expectedEndMinutes =
      ((expectedEndAbsolute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    const expectedEndHours = Math.floor(expectedEndMinutes / 60);
    const expectedEndMinute = expectedEndMinutes % 60;
    expectedEndTime = `${expectedEndHours.toString().padStart(2, '0')}:${expectedEndMinute.toString().padStart(2, '0')}`;
  } else if (
    remainingMinutes === 0 &&
    validBlocks.length > 0 &&
    numericTargetHours > 0
  ) {
    expectedEndTime = 'Feierabend! 🎉';
  }

  const breakBreakdown: BreakDetail[] = [];
  let accountedBreak = 0;

  for (let i = 0; i < validBlocks.length; i++) {
    const blockIndex = i + 1;
    const remainingBreakNeeded = Math.max(
      0,
      expectedLegalBreak - accountedBreak,
    );

    const autoForBlock = autoDetails.find(
      (detail) => detail.inBlock === blockIndex,
    );
    if (autoForBlock && remainingBreakNeeded > 0) {
      const applied = Math.min(autoForBlock.amount, remainingBreakNeeded);
      breakBreakdown.push({
        label: `Abzug in Log-In ${blockIndex}`,
        amount: applied,
        type: 'auto',
      });
      accountedBreak += applied;
    }

    const manualForBlock = gapDetails.find(
      (detail) => detail.afterBlock === blockIndex,
    );
    if (manualForBlock && accountedBreak < expectedLegalBreak) {
      const needed = expectedLegalBreak - accountedBreak;
      const applied = Math.min(manualForBlock.amount, needed);
      if (applied > 0) {
        breakBreakdown.push({
          label: `Abzug Log-Out Zeit nach Log-In ${blockIndex}`,
          amount: applied,
          type: 'manual',
        });
        accountedBreak += applied;
      }
    }
  }

  const officialWindowFeedback: { label: string; amount: number }[] = [];
  let earlyLoginMinutes = 0;

  timeBlocks.forEach((block, index) => {
    const loginMinutes = timeToMinutes(block.login);
    const logoutMinutes = timeToMinutes(block.logout);

    if (loginMinutes !== null && loginMinutes < WORK_START_MINUTES) {
      earlyLoginMinutes += WORK_START_MINUTES - loginMinutes;
      officialWindowFeedback.push({
        label: `Log-In ${index + 1} ist zu frueh`,
        amount: WORK_START_MINUTES - loginMinutes,
      });
    }

    if (loginMinutes !== null && loginMinutes > WORK_END_MINUTES) {
      officialWindowFeedback.push({
        label: `Log-In ${index + 1} ist zu spaet`,
        amount: loginMinutes - WORK_END_MINUTES,
      });
    }

    if (logoutMinutes !== null && logoutMinutes < WORK_START_MINUTES) {
      officialWindowFeedback.push({
        label: `Log-Out ${index + 1} ist zu frueh`,
        amount: WORK_START_MINUTES - logoutMinutes,
      });
    }

    if (logoutMinutes !== null && logoutMinutes > WORK_END_MINUTES) {
      officialWindowFeedback.push({
        label: `Log-Out ${index + 1} ist zu spaet`,
        amount: logoutMinutes - WORK_END_MINUTES,
      });
    }
  });

  return {
    numericTargetHours,
    remainingMinutes,
    expectedEndTime,
    lostMinutes,
    earlyLoginMinutes,
    isActiveShift,
    workedTime: minutesToTimeString(effectiveWorked),
    remainingTime: minutesToTimeString(remainingMinutes),
    hasOpenBlock: validBlocks.some((block) => !block.hasOut),
    shouldMuteRemainingTime:
      numericTargetHours === 0 ||
      (remainingMinutes === 0 && numericTargetHours > 0),
    expectedLegalBreak,
    breakBreakdown,
    accountedBreak,
    hasActivePause: breakBreakdown.length > 0,
    gapDetails,
    totalManualGaps,
    officialWindowFeedback,
  };
}

export default calculateWorkTime;
