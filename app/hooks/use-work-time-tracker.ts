'use client';

import { useEffect, useState } from 'react';
import type { TimeBlock } from '../lib/work-time-types';

const STORAGE_KEY = 'workTimeTrackerData';
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

type PersistedWorkTimeData = {
  targetHours: number | string;
  timeBlocks: TimeBlock[];
  timestamp: number;
};

function loadWorkTimeData(): PersistedWorkTimeData | null {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (!savedData) return null;

    const parsed = JSON.parse(savedData) as PersistedWorkTimeData;
    if (
      Array.isArray(parsed?.timeBlocks) &&
      parsed.timeBlocks.length > 0 &&
      Date.now() - parsed.timestamp < TWELVE_HOURS_MS
    ) {
      return parsed;
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error reading local storage data', error);
  }

  return null;
}

function saveWorkTimeData(data: PersistedWorkTimeData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error writing local storage data', error);
  }
}

export default function useWorkTimeTracker() {
  const [initialData] = useState(loadWorkTimeData);
  const [targetHours, setTargetHours] = useState<number | string>(
    initialData?.targetHours ?? 8,
  );
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>(
    initialData?.timeBlocks ?? [{ login: '', logout: '' }],
  );
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    saveWorkTimeData({ targetHours, timeBlocks, timestamp: Date.now() });
  }, [targetHours, timeBlocks]);

  const addTimeBlock = () => {
    setTimeBlocks((blocks) => [...blocks, { login: '', logout: '' }]);
  };

  const removeTimeBlock = (indexToRemove: number) => {
    setTimeBlocks((blocks) =>
      blocks.filter((_, index) => index !== indexToRemove),
    );
  };

  const updateTimeBlock = (
    index: number,
    field: keyof TimeBlock,
    value: string,
  ) => {
    setTimeBlocks((blocks) =>
      blocks.map((block, blockIndex) =>
        blockIndex === index ? { ...block, [field]: value } : block,
      ),
    );
  };

  return {
    targetHours,
    setTargetHours,
    timeBlocks,
    addTimeBlock,
    removeTimeBlock,
    updateTimeBlock,
    now,
  };
}
