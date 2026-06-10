import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import clsx from 'clsx';

interface CountdownTimerProps {
  endTime: string;
  onExpire?: () => void;
  className?: string;
  compact?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

export function CountdownTimer({ endTime, onExpire, className, compact = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false });
  const [hasNotified, setHasNotified] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(endTime).getTime() - new Date().getTime();
      
      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isExpired: false,
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      if (newTimeLeft.isExpired && !hasNotified) {
        setHasNotified(true);
        clearInterval(timer);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime, onExpire, hasNotified]);

  if (timeLeft.isExpired) {
    return (
      <div className={clsx("flex items-center text-destructive font-semibold", className)}>
        <Clock className={clsx("mr-1.5", compact ? "w-4 h-4" : "w-5 h-5")} />
        Auction Ended
      </div>
    );
  }

  // Warning state: less than 1 hour remaining
  const isEndingSoon = timeLeft.days === 0 && timeLeft.hours === 0;

  if (compact) {
    return (
      <div className={clsx(
        "flex items-center font-medium",
        isEndingSoon ? "text-orange-600" : "text-slate-600",
        className
      )}>
        <Clock className="w-4 h-4 mr-1.5" />
        {timeLeft.days > 0 && `${timeLeft.days}d `}
        {timeLeft.hours.toString().padStart(2, '0')}:
        {timeLeft.minutes.toString().padStart(2, '0')}:
        {timeLeft.seconds.toString().padStart(2, '0')}
      </div>
    );
  }

  return (
    <div className={clsx("flex gap-2 text-center", className)}>
      <div className="flex flex-col bg-slate-100 rounded-lg p-2 min-w-[3.5rem]">
        <span className="text-xl font-bold text-slate-900">{timeLeft.days}</span>
        <span className="text-xs text-slate-500 uppercase font-medium">Days</span>
      </div>
      <div className="flex flex-col bg-slate-100 rounded-lg p-2 min-w-[3.5rem]">
        <span className="text-xl font-bold text-slate-900">{timeLeft.hours.toString().padStart(2, '0')}</span>
        <span className="text-xs text-slate-500 uppercase font-medium">Hrs</span>
      </div>
      <div className="flex flex-col bg-slate-100 rounded-lg p-2 min-w-[3.5rem]">
        <span className="text-xl font-bold text-slate-900">{timeLeft.minutes.toString().padStart(2, '0')}</span>
        <span className="text-xs text-slate-500 uppercase font-medium">Min</span>
      </div>
      <div className={clsx(
        "flex flex-col rounded-lg p-2 min-w-[3.5rem]",
        isEndingSoon ? "bg-orange-100" : "bg-slate-100"
      )}>
        <span className={clsx("text-xl font-bold", isEndingSoon ? "text-orange-700 animate-pulse" : "text-slate-900")}>
          {timeLeft.seconds.toString().padStart(2, '0')}
        </span>
        <span className={clsx("text-xs uppercase font-medium", isEndingSoon ? "text-orange-600" : "text-slate-500")}>
          Sec
        </span>
      </div>
    </div>
  );
}
