import { useState, useEffect } from "react";
import { Clock, Edit, Check, X, Timer } from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import { useTimeSlots } from "../context/TimeSlotContext";
import { fetchActionPassword } from "../services/firestoreService";
import { checkActionRateLimit, recordFailedAction, resetActionRateLimit } from "../utils/rateLimiter";

export function TimeSlots() {
  const { 
    timeSlots, 
    setTimeSlots,
    thresholdMinutes,
    setThresholdMinutes,
    autoToggleEnabled,
    setAutoToggleEnabled
  } = useTimeSlots();
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ name: "", startTime: "", endTime: "" });
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [pendingSlotId, setPendingSlotId] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [passwordError, setPasswordError] = useState("");



  // Lockout interval for action limit
  useEffect(() => {
    if (!passwordDialogOpen) return;
    const checkLockout = () => {
      const rateLimit = checkActionRateLimit('timeslots');
      if (!rateLimit.allowed) {
        setLockoutSeconds(rateLimit.remainingSeconds);
        setPasswordError(`Too many attempts. Locked for ${rateLimit.remainingSeconds}s`);
      } else {
        if (lockoutSeconds > 0) setPasswordError("");
        setLockoutSeconds(0);
      }
    };
    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [passwordDialogOpen, lockoutSeconds]);

  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = (slot: typeof timeSlots[0]) => {
    setEditingId(slot.id);
    setEditData({ name: slot.name, startTime: slot.startTime, endTime: slot.endTime });
  };

  const handleSave = async (id: number) => {
    setIsSaving(true);
    try {
      const newSlots = timeSlots.map((slot) =>
        slot.id === id
          ? { ...slot, name: editData.name, startTime: editData.startTime, endTime: editData.endTime }
          : slot
      );
      // setTimeSlots now points to saveTimeSlots in context
      await setTimeSlots(newSlots as any);
      setEditingId(null);
    } catch (error) {
      console.error("Failed to save time slots:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateName = (id: number, newName: string) => {
    setEditData({ ...editData, name: newName });
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleAddSlot = () => {
    const newId = timeSlots.length > 0 ? Math.max(...timeSlots.map(s => s.id)) + 1 : 1;
    const newSlot = {
      id: newId,
      name: "New Slot",
      startTime: "00:00",
      endTime: "00:00",
      active: false
    };
    setTimeSlots([...timeSlots, newSlot] as any);
    setEditingId(newId);
    setEditData({ name: "New Slot", startTime: "00:00", endTime: "00:00" });
  };

  const handleDeleteSlot = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this slot?")) return;
    const newSlots = timeSlots.filter(s => s.id !== id);
    await setTimeSlots(newSlots as any);
  };

  const toggleActiveSlot = async (id: number) => {
    const slot = timeSlots.find(s => s.id === id);
    if (!slot) return;
    
    if (slot.active) {
       await import("../services/timeSlotService").then(({ timeSlotService }) => timeSlotService.deactivateSlot());
    } else {
       const mappedSlot = { ...slot };
       delete mappedSlot.active; 
       await import("../services/timeSlotService").then(({ timeSlotService }) => timeSlotService.activateSlot(mappedSlot));
    }
  };

  const handleToggleAttempt = (slotId: number) => {
    setPendingSlotId(slotId);
    setPasswordDialogOpen(true);
    setPasswordInput("");
    setPasswordError("");
  };

  const handlePasswordSubmit = async () => {
    const rateLimit = checkActionRateLimit('timeslots');
    if (!rateLimit.allowed) {
      setPasswordError(`Too many attempts. Locked out for ${rateLimit.remainingSeconds}s`);
      return;
    }

    try {
      const storedPasswordBtoa = await fetchActionPassword();
      const actualPassword = storedPasswordBtoa ? atob(storedPasswordBtoa) : "12345";
      
      if (passwordInput === actualPassword) {
        resetActionRateLimit('timeslots');
        setPasswordDialogOpen(false);
        setPasswordInput("");
        setPasswordError("");
        // Start 15-second countdown
        setCountdown(15);
        
        const interval = setInterval(() => {
          setCountdown((prev) => {
            if (prev === null || prev <= 1) {
              clearInterval(interval);
              // Execute the toggle after countdown
              if (pendingSlotId !== null) {
                toggleActiveSlot(pendingSlotId);
              }
              setPendingSlotId(null);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        recordFailedAction('timeslots');
        const updatedRateLimit = checkActionRateLimit('timeslots');
        if (!updatedRateLimit.allowed) {
           setPasswordError(`Account locked. Try again in ${updatedRateLimit.remainingSeconds}s`);
        } else {
           setPasswordError("Incorrect password. Please try again.");
        }
      }
    } catch (e) {
      console.error("Failed to verify action password", e);
      setPasswordError("Error verifying password. Please try again.");
    }
  };


  const handlePasswordCancel = () => {
    setPasswordDialogOpen(false);
    setPasswordInput("");
    setPasswordError("");
    setPendingSlotId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Time Slot Management</h1>
          <p className="text-muted-foreground">Configure meal time slots and ordering windows</p>
        </div>
        <button
          onClick={handleAddSlot}
          className="bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-lg"
        >
          <Clock className="h-5 w-5" />
          Add New Slot
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {timeSlots.length > 0 ? (
          timeSlots.map((slot) => (
          <div
            key={slot.id}
            className={`rounded-xl p-6 border-2 transition-all ${
              slot.active
                ? "bg-accent/20 border-accent shadow-lg"
                : "bg-card border-border shadow-sm hover:shadow-md"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-lg ${
                    slot.active ? "bg-accent" : "bg-primary/20"
                  }`}
                >
                  <Clock
                    className={`h-6 w-6 ${
                      slot.active ? "text-accent-foreground" : "text-primary"
                    }`}
                  />
                </div>
                <div>
                  {editingId === slot.id ? (
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="bg-input-background text-foreground px-2 py-1 rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary font-bold text-xl w-full"
                    />
                  ) : (
                    <h3 className="text-xl font-bold text-foreground">{slot.name}</h3>
                  )}
                  {slot.active && (
                    <span className="text-xs font-semibold text-accent-foreground bg-accent px-2 py-1 rounded-full inline-block mt-1">
                      ACTIVE NOW
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {editingId !== slot.id && (
                  <>
                    <button
                      onClick={() => handleEdit(slot)}
                      className={`p-2 rounded-lg transition-colors ${
                        slot.active 
                          ? "bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground" 
                          : "bg-primary/20 hover:bg-primary text-primary hover:text-primary-foreground"
                      }`}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSlot(slot.id)}
                      className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive text-destructive hover:text-destructive-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {editingId === slot.id ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={editData.startTime}
                    onChange={(e) =>
                      setEditData({ ...editData, startTime: e.target.value })
                    }
                    className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={editData.endTime}
                    onChange={(e) =>
                      setEditData({ ...editData, endTime: e.target.value })
                    }
                    className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(slot.id)}
                    disabled={isSaving}
                    className="flex-1 bg-accent text-accent-foreground px-4 py-2 rounded-lg font-semibold hover:bg-accent/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <div className="h-4 w-4 border-2 border-accent-foreground border-t-transparent animate-spin rounded-full" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex-1 bg-muted text-foreground px-4 py-2 rounded-lg font-semibold hover:bg-muted/80 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Start Time</p>
                      <p className="text-lg font-bold text-foreground">{slot.startTime}</p>
                    </div>
                    <div className="text-muted-foreground">→</div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">End Time</p>
                      <p className="text-lg font-bold text-foreground">{slot.endTime}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-sm font-semibold text-foreground">Set as Active Slot</span>
                  <div className="flex items-center gap-2">
                    <Switch.Root
                      checked={slot.active}
                      onCheckedChange={() => handleToggleAttempt(slot.id)}
                      className="w-12 h-6 bg-muted rounded-full relative data-[state=checked]:bg-accent transition-colors"
                    >
                      <Switch.Thumb className="block w-5 h-5 bg-foreground rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[26px]" />
                    </Switch.Root>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="col-span-full bg-card rounded-xl border border-border border-dashed p-12 text-center">
          <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-1">No Time Slots Defined</h3>
          <p className="text-muted-foreground">Click "Add New Slot" to start building your mess schedule.</p>
        </div>
      )}
      </div>

      

      {/* Auto Toggle Off Settings */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Auto Toggle Off Settings</h3>
          </div>
          
          {/* Enable/Disable Toggle */}
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${autoToggleEnabled ? 'text-green-600' : 'text-muted-foreground'}`}>
              {autoToggleEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <Switch.Root
              checked={autoToggleEnabled}
              onCheckedChange={setAutoToggleEnabled}
              className="w-12 h-6 bg-muted rounded-full relative data-[state=checked]:bg-accent transition-colors"
            >
              <Switch.Thumb className="block w-5 h-5 bg-foreground rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[26px]" />
            </Switch.Root>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          {autoToggleEnabled 
            ? 'Slots will automatically turn ON at their start time and turn OFF after the mess end time (giving extra ordering time). No password required for auto-toggle.'
            : 'Auto toggle is currently disabled. Slots will remain inactive until manually toggled on.'}
        </p>
        
        <div className={`max-w-xs transition-opacity ${autoToggleEnabled ? 'opacity-100' : 'opacity-50'}`}>
          <label className="block text-sm font-semibold text-foreground mb-2">
            Extra Ordering Time (minutes after mess end time)
          </label>
          <input
            type="number"
            min="0"
            max="60"
            value={thresholdMinutes}
            onChange={(e) => setThresholdMinutes(parseInt(e.target.value) || 0)}
            disabled={!autoToggleEnabled}
            className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Enter minutes"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Example: If set to 5 minutes and mess ends at 9:40 AM, ordering will close at 9:45 AM
          </p>
        </div>
      </div>

      {/* Password Dialog */}
      {passwordDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 border border-border w-96">
            <h3 className="text-lg font-bold text-foreground mb-3">Enter Password</h3>
            <p className="text-sm text-muted-foreground mb-4">Please enter the password to change the active slot.</p>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter password"
              autoFocus
            />
            {passwordError && <p className="text-sm text-destructive mt-2">{passwordError}</p>}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handlePasswordSubmit}
                disabled={lockoutSeconds > 0}
                className="flex-1 bg-accent text-accent-foreground px-4 py-2 rounded-lg font-semibold hover:bg-accent/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-4 w-4" />
                Submit
              </button>
              <button
                onClick={handlePasswordCancel}
                className="flex-1 bg-muted text-foreground px-4 py-2 rounded-lg font-semibold hover:bg-muted/80 transition-colors flex items-center justify-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Countdown Timer Overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-8 border border-border w-96 text-center">
            <Clock className="h-16 w-16 text-accent mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-foreground mb-2">Updating Active Slot</h3>
            <p className="text-sm text-muted-foreground mb-6">
              The slot will be updated in...
            </p>
            <div className="text-6xl font-bold text-accent mb-4">{countdown}</div>
            <p className="text-sm text-muted-foreground">seconds remaining</p>
          </div>
        </div>
      )}
    </div>
  );
}