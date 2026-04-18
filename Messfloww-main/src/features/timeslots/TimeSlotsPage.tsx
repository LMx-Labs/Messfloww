import { useState, useEffect } from "react";
import { Clock, Edit, Check, X, Timer } from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import { useTimeSlots } from "../../features/timeslots/TimeSlotContext";
import { fetchActionPassword } from "../../features/students/studentService";
import { checkActionRateLimit, recordFailedAction, resetActionRateLimit } from "../../app/utils/rateLimiter";
import { timeSlotService } from "./timeSlotService";
import { toast } from "sonner";

export function TimeSlotsPage() {
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
  const [isSaving, setIsSaving] = useState(false);

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

  const handleEdit = (slot: any) => {
    setEditingId(slot.id);
    setEditData({ name: slot.name, startTime: slot.startTime, endTime: slot.endTime });
  };

  const handleSave = async (id: number) => {
    setIsSaving(true);
    try {
      const newSlots = timeSlots.map((slot) =>
        slot.id === id ? { ...slot, ...editData } : slot
      );
      await setTimeSlots(newSlots as any);
      setEditingId(null);
      toast.success("Saved");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSlot = () => {
    const newId = Date.now();
    const newSlot = {
      id: newId,
      name: "New Slot",
      startTime: "00:00",
      endTime: "00:00",
      active: false
    };
    setTimeSlots([...timeSlots, newSlot] as any);
    handleEdit(newSlot);
  };

  const handleDeleteSlot = (id: number) => {
    if (confirm("Delete this slot?")) {
      setTimeSlots(timeSlots.filter(s => s.id !== id) as any);
    }
  };

  const toggleActiveSlot = async (id: number) => {
    const slot = timeSlots.find(s => s.id === id);
    if (!slot) return;
    if (slot.active) {
       await timeSlotService.deactivateSlot();
    } else {
       await timeSlotService.activateSlot(slot);
    }
    toast.success("Slot updated");
  };

  const handlePasswordSubmit = async () => {
    const actualPassword = await fetchActionPassword();
    if (passwordInput === actualPassword) {
      resetActionRateLimit('timeslots');
      setPasswordDialogOpen(false);
      setCountdown(10);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            if (pendingSlotId !== null) toggleActiveSlot(pendingSlotId);
            setPendingSlotId(null);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      recordFailedAction('timeslots');
      setPasswordError("Incorrect password");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black mb-2">Time Management</h1>
          <p className="text-muted-foreground">Define business hours and ordering windows</p>
        </div>
        <button onClick={handleAddSlot} className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold shadow-lg">New Slot</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {timeSlots.map(slot => (
            <div key={slot.id} className={`p-6 rounded-3xl border-2 transition-all ${slot.active ? 'bg-accent/10 border-accent' : 'bg-card border-border'}`}>
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${slot.active ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary'}`}><Clock className="w-6 h-6" /></div>
                        <div>
                            {editingId === slot.id ? (
                                <input type="text" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="bg-input-background p-1 border rounded w-32 font-bold" />
                            ) : (
                                <h3 className="text-xl font-black">{slot.name}</h3>
                            )}
                            {slot.active && <span className="text-[10px] font-black uppercase tracking-widest text-accent">Active Now</span>}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handleEdit(slot)} className="p-2 bg-muted rounded-lg"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteSlot(slot.id)} className="p-2 bg-destructive/10 text-destructive rounded-lg"><X className="w-4 h-4" /></button>
                    </div>
                </div>

                {editingId === slot.id ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <input type="time" value={editData.startTime} onChange={e => setEditData({ ...editData, startTime: e.target.value })} className="bg-muted p-2 rounded-lg font-bold" />
                            <input type="time" value={editData.endTime} onChange={e => setEditData({ ...editData, endTime: e.target.value })} className="bg-muted p-2 rounded-lg font-bold" />
                        </div>
                        <button onClick={() => handleSave(slot.id)} disabled={isSaving} className="w-full bg-accent text-accent-foreground py-2 rounded-xl font-bold">{isSaving ? '...' : 'Save Changes'}</button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between bg-muted/30 p-4 rounded-2xl font-black">
                            <div><p className="text-[8px] opacity-50 uppercase">Start</p>{slot.startTime}</div>
                            <div><p className="text-[8px] opacity-50 uppercase">End</p>{slot.endTime}</div>
                        </div>
                        <div className="flex justify-between items-center bg-card-background border border-border p-4 rounded-xl">
                            <span className="text-xs font-bold">Manual Activation</span>
                            <Switch.Root checked={slot.active} onCheckedChange={() => { setPendingSlotId(slot.id); setPasswordDialogOpen(true); }} className="w-10 h-6 bg-muted rounded-full relative data-[state=checked]:bg-accent transition-colors">
                                <Switch.Thumb className="block w-4 h-4 bg-foreground rounded-full transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
                            </Switch.Root>
                        </div>
                    </div>
                )}
            </div>
        ))}
      </div>

      <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3"><Timer className="w-6 h-6 text-primary" /><h3 className="text-xl font-black">Automation</h3></div>
            <Switch.Root checked={autoToggleEnabled} onCheckedChange={setAutoToggleEnabled} className="w-10 h-6 bg-muted rounded-full relative data-[state=checked]:bg-accent transition-colors">
                <Switch.Thumb className="block w-4 h-4 bg-foreground rounded-full transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
            </Switch.Root>
        </div>
        <p className="text-sm text-muted-foreground mb-6">Automate slot state based on system clock. Overrides manual settings.</p>
        <div className="max-w-xs space-y-2">
            <label className="text-xs font-black uppercase text-muted-foreground">Buffer Minutes</label>
            <input type="number" value={thresholdMinutes} onChange={e => setThresholdMinutes(parseInt(e.target.value) || 0)} className="w-full bg-input-background p-3 rounded-xl border border-border font-bold" />
        </div>
      </div>

      {passwordDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-sm p-8 rounded-3xl border border-border space-y-4 shadow-2xl">
                <h2 className="text-xl font-black">Security Pin</h2>
                <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()} placeholder="••••" className="w-full bg-input-background p-4 rounded-xl border border-border text-center text-2xl tracking-[1em] font-black focus:ring-2 focus:ring-primary outline-none" autoFocus />
                {passwordError && <p className="text-xs text-destructive text-center font-bold">{passwordError}</p>}
                <div className="flex gap-3">
                    <button onClick={() => setPasswordDialogOpen(false)} className="flex-1 py-3 bg-muted rounded-xl font-bold">Cancel</button>
                    <button onClick={handlePasswordSubmit} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold shadow-lg">Submit</button>
                </div>
            </div>
        </div>
      )}

      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/95 text-primary-foreground backdrop-blur-xl animate-in zoom-in-95 duration-300">
            <div className="text-center space-y-4">
                <p className="text-xs font-black uppercase tracking-[0.4em]">Activating Sequence</p>
                <p className="text-9xl font-black">{countdown}</p>
                <p className="text-sm opacity-50">Please wait while the system updates...</p>
            </div>
        </div>
      )}
    </div>
  );
}
