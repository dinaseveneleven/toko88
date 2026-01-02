import { useCallback, useRef } from 'react';

interface UseTripleTapOptions {
  onTripleTap: () => void;
  timeWindow?: number; // ms between taps
}

export function useTripleTap({ onTripleTap, timeWindow = 500 }: UseTripleTapOptions) {
  const tapTimestamps = useRef<number[]>([]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    
    // Filter out taps that are too old
    tapTimestamps.current = tapTimestamps.current.filter(
      (timestamp) => now - timestamp < timeWindow
    );
    
    // Add current tap
    tapTimestamps.current.push(now);
    
    // Check if we have 3 taps within the time window
    if (tapTimestamps.current.length >= 3) {
      // Reset timestamps
      tapTimestamps.current = [];
      
      // Trigger haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }
      
      onTripleTap();
    }
  }, [onTripleTap, timeWindow]);

  return { handleTap };
}
