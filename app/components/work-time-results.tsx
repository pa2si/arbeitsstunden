'use client';

import { minutesToTimeString } from '../lib/work-time-calculator';
import type { WorkTimeCalculation } from '../lib/work-time-types';

type WorkTimeResultsProps = {
  calculation: WorkTimeCalculation;
  isDetailsOpen: boolean;
  onToggleDetails: () => void;
};

function DetailRow({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className='flex justify-between items-center text-sm'>
      <span className={className}>{label}</span>
      <span className={`font-bold ${className}`}>{value}</span>
    </div>
  );
}

export default function WorkTimeResults({
  calculation,
  isDetailsOpen,
  onToggleDetails,
}: WorkTimeResultsProps) {
  const {
    numericTargetHours,
    remainingMinutes,
    expectedEndTime,
    lostMinutes,
    earlyLoginMinutes,
    isActiveShift,
    workedTime,
    remainingTime,
    hasOpenBlock,
    shouldMuteRemainingTime,
    expectedLegalBreak,
    breakBreakdown,
    accountedBreak,
    hasActivePause,
    gapDetails,
    totalManualGaps,
    officialWindowFeedback,
  } = calculation;
  const targetReached = remainingMinutes === 0 && numericTargetHours > 0;

  return (
    <div className='mt-8 space-y-3 pt-4 border-t border-slate-200'>
      <div
        className={`flex items-center p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-300/60 relative overflow-hidden ${targetReached ? 'justify-center' : 'justify-between'}`}
      >
        {!targetReached && (
          <div className='flex flex-col relative z-10'>
            <span className='text-sm font-medium text-indigo-100'>
              Arbeitsende
            </span>
            <span className='text-xs text-indigo-200'>
              {isActiveShift
                ? 'Läuft: Projektion von Log In'
                : 'Dynamisch berechnet'}
            </span>
          </div>
        )}
        <span className='text-3xl font-extrabold tracking-tight relative z-10'>
          {expectedEndTime}
        </span>
        {isActiveShift && (
          <div className='absolute top-0 right-0 w-full h-full bg-white opacity-5 rounded-2xl' />
        )}
      </div>

      {earlyLoginMinutes > 0 && (
        <div className='bg-rose-50/90 border border-rose-200 p-3 rounded-2xl shadow-sm text-sm text-rose-800'>
          {minutesToTimeString(earlyLoginMinutes)} vor 06:00 werden nicht
          angerechnet, die Zählung beginnt erst um 06:00.
        </div>
      )}

      {lostMinutes > 0 && (
        <div className='bg-rose-50/90 border border-rose-200 p-3 rounded-2xl shadow-sm text-sm text-rose-800'>
          {minutesToTimeString(lostMinutes)} gehen verloren, da die maximale
          Arbeitszeit bis 21:00 geht.
        </div>
      )}

      <button
        type='button'
        onClick={onToggleDetails}
        aria-expanded={isDetailsOpen}
        className='w-full flex items-center justify-between p-3 mt-2 text-sm font-medium text-slate-600 bg-white/50 hover:bg-white/80 border border-slate-200 rounded-xl transition-all'
      >
        <span>📋 Details zur Berechnung</span>
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${isDetailsOpen ? 'rotate-180' : ''}`}
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M19 9l-7 7-7-7'
          />
        </svg>
      </button>

      {isDetailsOpen && (
        <div className='space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-300'>
          <div
            className={`flex justify-between items-center p-4 rounded-2xl border shadow-sm ${targetReached ? 'bg-emerald-50/80 border-emerald-100' : 'bg-white border-slate-200'}`}
          >
            <span
              className={`text-sm font-medium ${targetReached ? 'text-emerald-800' : 'text-slate-600'}`}
            >
              Effektive Arbeitszeit {hasOpenBlock ? '(bisher)' : ''}
            </span>
            <span
              className={`text-lg font-bold ${targetReached ? 'text-emerald-700' : 'text-slate-800'}`}
            >
              {workedTime}
            </span>
          </div>

          {officialWindowFeedback.length > 0 && (
            <div className='bg-rose-50/90 border border-rose-200 p-4 rounded-2xl shadow-sm space-y-3'>
              <div className='flex items-center text-sm font-semibold text-rose-800 mb-1'>
                Zeit ausserhalb 06:00 - 21:00
              </div>
              {officialWindowFeedback.map((item) => (
                <DetailRow
                  key={item.label}
                  label={item.label}
                  value={minutesToTimeString(item.amount)}
                  className='text-rose-700'
                />
              ))}
              <div className='pt-2 border-t border-rose-200/60 text-xs text-rose-700'>
                Diese Zeit wird nicht validiert und nicht angerechnet.
              </div>
            </div>
          )}

          {gapDetails.length > 0 && (
            <div className='bg-sky-50/80 border border-sky-100 p-4 rounded-2xl shadow-sm space-y-3'>
              <div className='flex items-center text-sm font-semibold text-sky-800 mb-1'>
                Gesamte erfasste Log-Out Zeit
              </div>
              {gapDetails.map((gap) => (
                <DetailRow
                  key={gap.afterBlock}
                  label={`Nach Log-In ${gap.afterBlock}`}
                  value={minutesToTimeString(gap.amount)}
                  className='text-sky-700'
                />
              ))}
              {gapDetails.length > 1 && (
                <div className='flex justify-between items-center pt-2 border-t border-sky-200/60'>
                  <span className='text-sm font-medium text-sky-800'>
                    Gesamte Log-Out Pause
                  </span>
                  <span className='font-bold text-sky-800'>
                    {minutesToTimeString(totalManualGaps)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div
            className={`p-4 rounded-2xl border shadow-sm space-y-3 ${hasActivePause ? 'bg-amber-50/80 border-amber-200' : 'bg-slate-50/80 border-slate-200'}`}
          >
            <div
              className={`flex items-center justify-between text-sm font-semibold mb-1 ${hasActivePause ? 'text-amber-800' : 'text-slate-600'}`}
            >
              <span>Anrechnung Gesetzliche Pause</span>
              {expectedLegalBreak > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-md border ${hasActivePause ? 'text-amber-600 bg-amber-100 border-amber-200' : 'text-slate-500 bg-slate-100 border-slate-200'}`}
                >
                  Von: {expectedLegalBreak}m
                </span>
              )}
            </div>

            {breakBreakdown.map((item) => (
              <DetailRow
                key={item.label}
                label={item.label}
                value={`${item.amount}m`}
                className='text-amber-700'
              />
            ))}

            {breakBreakdown.length > 1 && (
              <div className='flex justify-between items-center pt-2 border-t border-amber-200/60'>
                <span className='text-sm font-medium text-amber-800'>
                  Gesamte abgezogene Pausenzeit
                </span>
                <span className='font-bold text-amber-800'>
                  {accountedBreak}m
                </span>
              </div>
            )}

            {breakBreakdown.length === 0 && (
              <DetailRow
                label='Kein Abzug notwendig'
                value='0m'
                className='text-slate-500'
              />
            )}
          </div>

          <div
            className={`flex justify-between items-center p-4 rounded-2xl border shadow-sm ${shouldMuteRemainingTime ? 'bg-slate-100/80 border-slate-200' : 'bg-rose-50/80 border-rose-100'}`}
          >
            <span
              className={`text-sm font-medium ${shouldMuteRemainingTime ? 'text-slate-400' : 'text-rose-800'}`}
            >
              Verbleibende Zeit
            </span>
            <span
              className={`text-xl font-bold ${shouldMuteRemainingTime ? 'text-slate-400' : 'text-rose-700'}`}
            >
              {remainingTime}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
