import { useState, useEffect } from "react";
import { Clock, Edit, Check, X, Timer } from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import { useTimeSlots } from "../../features/timeslots/TimeSlotContext";
import { timeSlotService } from "@messflow/shared-core";
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
  const [isSaving, setIsSaving] = useState(false);



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
                            <Switch.Root checked={slot.active} onCheckedChange={() => toggleActiveSlot(slot.id)} className="w-10 h-6 bg-muted rounded-full relative data-[state=checked]:bg-accent transition-colors">
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


    </div>
  );
}
