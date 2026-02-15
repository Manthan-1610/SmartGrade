/**
 * CountdownTimer Component
 * 
 * Displays remaining time until exam deadline.
 * Syncs with server time and updates every second.
 */
import { useState, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle, CheckCircle, Hourglass } from 'lucide-react';
import { Badge } from '@/components/ui';

interface CountdownTimerProps {
  /** Effective deadline (ISO string) */
  deadline: string | null;
  /** Grace period in minutes */
  gracePeriodMinutes: number;
  /** Server time for synchronization (ISO string) */
  serverTime: string;
  /** Whether the student has an extension */
  hasExtension: boolean;
  /** Callback when time expires */
  onExpired?: () => void;
}

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isGracePeriod: boolean;
}

function calculateTimeRemaining(
  deadline: Date,
  gracePeriodMinutes: number,
  serverOffset: number, // milliseconds
): TimeRemaining | null {
  const now = new Date(Date.now() + serverOffset);
  const graceEnd = new Date(deadline.getTime() + gracePeriodMinutes * 60 * 1000);
  
  // Check if past grace period
  if (now >= graceEnd) {
    return null;
  }
  
  // Check if in grace period
  const isGracePeriod = now >= deadline;
  const targetTime = isGracePeriod ? graceEnd : deadline;
  
  const diff = targetTime.getTime() - now.getTime();
  const totalSeconds = Math.max(0, Math.floor(diff / 1000));
  
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
    isGracePeriod,
  };
}

export function CountdownTimer({
  deadline,
  gracePeriodMinutes,
  serverTime,
  hasExtension,
  onExpired,
}: CountdownTimerProps) {
  // Calculate offset between server time and local time
  const serverOffset = deadline
    ? new Date(serverTime).getTime() - Date.now()
    : 0;
  
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(
    deadline
      ? calculateTimeRemaining(new Date(deadline), gracePeriodMinutes, serverOffset)
      : null
  );

  const updateTimer = useCallback(() => {
    if (!deadline) {
      setTimeRemaining(null);
      return;
    }
    
    const remaining = calculateTimeRemaining(
      new Date(deadline),
      gracePeriodMinutes,
      serverOffset
    );
    
    setTimeRemaining(remaining);
    
    if (!remaining && onExpired) {
      onExpired();
    }
  }, [deadline, gracePeriodMinutes, serverOffset, onExpired]);

  useEffect(() => {
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [updateTimer]);

  // No deadline set
  if (!deadline) {
    return (
      <div className="flex items-center gap-2 text-text-muted">
        <Clock className="w-5 h-5" />
        <span>No time limit</span>
      </div>
    );
  }

  // Time expired
  if (!timeRemaining) {
    return (
      <div className="flex items-center gap-3 p-4 bg-danger/10 border border-danger/30 rounded-lg">
        <AlertTriangle className="w-6 h-6 text-danger" />
        <div>
          <p className="font-semibold text-danger">Time Expired</p>
          <p className="text-sm text-text-secondary">
            The submission deadline has passed.
          </p>
        </div>
      </div>
    );
  }

  // Determine urgency colors
  const isUrgent = timeRemaining.totalSeconds < 300; // < 5 minutes
  const isWarning = timeRemaining.totalSeconds < 900; // < 15 minutes
  
  const colorClass = timeRemaining.isGracePeriod
    ? 'text-warning'
    : isUrgent
      ? 'text-danger'
      : isWarning
        ? 'text-warning'
        : 'text-primary';
  
  const bgClass = timeRemaining.isGracePeriod
    ? 'bg-warning/10 border-warning/30'
    : isUrgent
      ? 'bg-danger/10 border-danger/30'
      : isWarning
        ? 'bg-warning/10 border-warning/30'
        : 'bg-primary/10 border-primary/30';

  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border ${bgClass}`}>
      <div className="flex items-center gap-3">
        {timeRemaining.isGracePeriod ? (
          <Hourglass className={`w-6 h-6 ${colorClass} animate-pulse`} />
        ) : (
          <Clock className={`w-6 h-6 ${colorClass}`} />
        )}
        <div>
          <p className={`font-semibold ${colorClass}`}>
            {timeRemaining.isGracePeriod ? 'Grace Period' : 'Time Remaining'}
          </p>
          {hasExtension && (
            <Badge variant="success" className="mt-1">
              <CheckCircle className="w-3 h-3 mr-1" />
              Extension Applied
            </Badge>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-1 font-mono text-2xl font-bold tabular-nums">
        <span className={colorClass}>
          {String(timeRemaining.hours).padStart(2, '0')}
        </span>
        <span className={`${colorClass} animate-pulse`}>:</span>
        <span className={colorClass}>
          {String(timeRemaining.minutes).padStart(2, '0')}
        </span>
        <span className={`${colorClass} animate-pulse`}>:</span>
        <span className={colorClass}>
          {String(timeRemaining.seconds).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
