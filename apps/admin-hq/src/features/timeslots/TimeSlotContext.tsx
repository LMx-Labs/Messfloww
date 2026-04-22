import { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { timeSlotService } from "@messflow/shared-core";
import { toast } from "sonner";

export interface TimeSlot {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  active?: boolean;
}

const initialTimeSlots: TimeSlot[] = [];

interface TimeSlotContextType {
  timeSlots: TimeSlot[];
  setTimeSlots: (slots: TimeSlot[]) => void;
  activeSlot: TimeSlot | null;
  loading: boolean;
  thresholdMinutes: number;
  setThresholdMinutes: (val: number) => void;
  autoToggleEnabled: boolean;
  setAutoToggleEnabled: (val: boolean) => void;
  isTabVisible: boolean;
  lastHiddenTime: number | null;
}

const TimeSlotContext = createContext<TimeSlotContextType | undefined>(undefined);

export function TimeSlotProvider({ children }: { children: ReactNode }) {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(initialTimeSlots);
  const [activeSlot, setActiveSlot] = useState<TimeSlot | null>(null);
  const [loading, setLoading] = useState(true);

  const [thresholdMinutes, setThresholdMinutes] = useState<number>(5);
  const [autoToggleEnabled, setAutoToggleEnabled] = useState<boolean>(true);
  const [isTabVisible, setIsTabVisible] = useState(!document.hidden);
  const [lastHiddenTime, setLastHiddenTime] = useState<number | null>(null);

  // Sync settings with Firestore when they change
  useEffect(() => {
    if (loading) return;
    const syncSettings = async () => {
      await timeSlotService.saveSettings({ thresholdMinutes, autoToggleEnabled });
    };
    syncSettings();
  }, [thresholdMinutes, autoToggleEnabled, loading]);

  // Auto-toggle OFF/ON logic
  useEffect(() => {
    if (!autoToggleEnabled || timeSlots.length === 0) return;
    
    const checkAutoToggle = () => {
      const now = new Date();
      const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

      timeSlots.forEach((slot) => {
        // Parse startTime and endTime (format: "HH:MM AM/PM" or "HH:MM")
        const parseTime = (timeStr: string) => {
          const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
          if (!timeParts) return null;
          
          let hours = parseInt(timeParts[1]);
          const minutes = parseInt(timeParts[2]);
          const period = timeParts[3];

          // Convert to 24-hour format if AM/PM is present
          if (period) {
            if (period.toUpperCase() === 'PM' && hours !== 12) {
              hours += 12;
            } else if (period.toUpperCase() === 'AM' && hours === 12) {
              hours = 0;
            }
          }

          return hours * 60 + minutes;
        };

        const startTimeMinutes = parseTime(slot.startTime);
        const endTimeMinutes = parseTime(slot.endTime);

        if (startTimeMinutes === null || endTimeMinutes === null) return;

        // Auto-off time is AFTER the end time (extra ordering time)
        const autoOffTimeMinutes = (endTimeMinutes + thresholdMinutes) % 1440;

        // Check if current time is within the slot's active window
        let isWithinActiveWindow = false;
        if (startTimeMinutes > autoOffTimeMinutes) {
          // Crosses midnight
          isWithinActiveWindow = currentTimeMinutes >= startTimeMinutes || currentTimeMinutes < autoOffTimeMinutes;
        } else {
          // Same day
          isWithinActiveWindow = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < autoOffTimeMinutes;
        }
        
        const isPastAutoOffTime = !isWithinActiveWindow;

        // Auto-toggle ON: If current time is within active window and slot is not active
        if (isWithinActiveWindow && !slot.active) {
          // Double check avoiding rapid duplicate toggles
          timeSlotService.activateSlot({
            id: slot.id,
            name: slot.name,
            startTime: slot.startTime,
            endTime: slot.endTime
          });
          console.log(`Auto-toggled ON: ${slot.name} at ${new Date().toLocaleTimeString()}`);
        }

        // Auto-toggle OFF: If current time >= auto-off time and slot is active
        if (isPastAutoOffTime && slot.active) {
          timeSlotService.deactivateSlot();
          console.log(`Auto-toggled OFF: ${slot.name} at ${new Date().toLocaleTimeString()}`);
        }
      });
    };

    // Check every 30 seconds
    const interval = setInterval(checkAutoToggle, 30000);
    checkAutoToggle();
    
    // Page Visibility API Guard
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsTabVisible(false);
        setLastHiddenTime(Date.now());
      } else {
        setIsTabVisible(true);
        // If hidden for > 5 minutes, force a check and warn
        setLastHiddenTime((prevTime) => {
          if (prevTime && Date.now() - prevTime > 5 * 60 * 1000) {
            toast.warning("Dashboard was hidden for a while. Re-syncing time slots now...");
            checkAutoToggle();
          } else {
            checkAutoToggle(); // Always check when returning
          }
          return null;
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [timeSlots, thresholdMinutes, autoToggleEnabled]);

  // 1. Fetch config and listen to active slot
  useEffect(() => {
    async function init() {
      const config = await timeSlotService.getTimeSlotsConfig();
      if (config) {
        setTimeSlots(config);
      }
      
      const settings = await timeSlotService.getSettings();
      if (settings) {
        setThresholdMinutes(settings.thresholdMinutes);
        setAutoToggleEnabled(settings.autoToggleEnabled);
      }
      
      setLoading(false);
    }
    
    init();

    const unsubscribe = timeSlotService.subscribeToActiveSlot((slot: TimeSlot | null) => {
      setActiveSlot(slot);
    });
    return () => unsubscribe();
  }, []);

  // 2. Automatic Background Sync
  // Ensures that RTDB 'isOpen' status always matches Firestore 'activeSlot' state.
  useEffect(() => {
    const syncStatus = async () => {
      try {
        const firestoreIsActive = !!activeSlot;
        await timeSlotService.syncMessStatus();
      } catch (err) {
        console.error("[SyncService] Failed to check status sync:", err);
      }
    };

    // Run on mount/change, and then every 60 seconds as a heartbeat
    syncStatus();
    const interval = setInterval(syncStatus, 60000);
    return () => clearInterval(interval);
  }, [activeSlot]);

  const saveTimeSlots = async (newSlots: TimeSlot[]) => {
    setTimeSlots(newSlots);
    await timeSlotService.saveTimeSlotsConfig(newSlots);
  };

  // Update timeSlots list to reflect active slot for UI mapping
  const mappedTimeSlots = timeSlots.map(slot => ({
    ...slot,
    active: activeSlot?.id === slot.id
  }));

  return (
    <TimeSlotContext.Provider value={{ 
      timeSlots: mappedTimeSlots, 
      setTimeSlots: saveTimeSlots, 
      activeSlot,
      loading,
      thresholdMinutes,
      setThresholdMinutes,
      autoToggleEnabled,
      setAutoToggleEnabled,
      isTabVisible,
      lastHiddenTime
    }}>
      {children}
    </TimeSlotContext.Provider>
  );
}

export function useTimeSlots() {
  const context = useContext(TimeSlotContext);
  if (!context) {
    throw new Error("useTimeSlots must be used within TimeSlotProvider");
  }
  return context;
}