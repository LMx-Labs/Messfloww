import { useState, useEffect } from "react";
import { Save, RefreshCw, CheckCircle2, ShieldAlert, Plus, Trash2, Mail, Loader2 } from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import * as settingsService from "./settingsService";
import { auth } from "../../core/firebase";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { toast } from "sonner";

const defaultSettings = {
  messName: "VIT Mess",
  adminEmail: "admin@vitstudent.ac.in",
  enableNotifications: true,
  autoRefreshOrders: true,
  refreshInterval: 30,
  taxRate: 5,
  enableWalletTopup: true,
  minBalance: 100,
  maxOrderAmount: 500,
  receiptAddress: "VIT University Campus",
  receiptGstNumber: "GSTINXXXXX",
  receiptFssaiNumber: "FSSAIXXXXX",
  receiptFooterMessage: "Thank you for dining with us!",
};

export function SettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [actionPasswordInput, setActionPasswordInput] = useState("");
  const [managerPasswordInput, setManagerPasswordInput] = useState("");
  const [staffPasswordInput, setStaffPasswordInput] = useState("");
  const [currentPasswordConfirm, setCurrentPasswordConfirm] = useState("");
  
  const [authorizedAdmins, setAuthorizedAdmins] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [remoteSettings, roles] = await Promise.all([
          settingsService.fetchSettings(),
          settingsService.fetchRoles()
        ]);
        if (remoteSettings) setSettings(remoteSettings as any);
        if (roles) setAuthorizedAdmins(roles.authorized_admins || []);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const reauthenticate = async () => {
    if (!auth.currentUser || !auth.currentUser.email) throw new Error("No user logged in");
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPasswordConfirm);
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  const handleUpdatePasswords = async (type: 'action' | 'manager' | 'staff') => {
    if (!currentPasswordConfirm) {
        toast.error("Re-authentication required");
        return;
    }
    try {
        await reauthenticate();
        if (type === 'action') await settingsService.saveActionPassword(btoa(actionPasswordInput));
        if (type === 'staff') await settingsService.saveStaffPassword(btoa(staffPasswordInput));
        if (type === 'manager') await updatePassword(auth.currentUser!, managerPasswordInput);
        toast.success("Password updated");
        setCurrentPasswordConfirm("");
        setActionPasswordInput("");
        setManagerPasswordInput("");
        setStaffPasswordInput("");
    } catch (e: any) {
        toast.error(e.message || "Failed to update");
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await settingsService.saveSettings(settings);
      toast.success("Settings saved");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAuthorizeEmail = async () => {
    if (!newAdminEmail) return;
    const email = newAdminEmail.toLowerCase().trim();
    if (authorizedAdmins.includes(email)) return;
    const newList = [...authorizedAdmins, email];
    await settingsService.saveRoles({ authorized_admins: newList });
    setAuthorizedAdmins(newList);
    setNewAdminEmail("");
    toast.success("Admin authorized");
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="bg-card p-8 rounded-3xl border border-border shadow-sm flex justify-between items-center">
        <div>
            <h1 className="text-4xl font-black">Control Center</h1>
            <p className="text-muted-foreground">Global configuration and access management</p>
        </div>
        <button onClick={handleSaveSettings} disabled={isSaving} className="flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black shadow-lg transition-transform active:scale-95">
            <Save className="w-5 h-5" /> {isSaving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
            <section className="bg-card p-8 rounded-3xl border border-border space-y-6">
                <h2 className="text-xl font-black flex items-center gap-3">General</h2>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground">Mess Name</label>
                        <input type="text" value={settings.messName} onChange={e => setSettings({...settings, messName: e.target.value})} className="w-full bg-input-background p-4 rounded-xl border border-border font-bold" />
                    </div>
                </div>
            </section>

            <section className="bg-card p-8 rounded-3xl border border-border space-y-6">
                <h2 className="text-xl font-black">Operations</h2>
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-muted/20 p-4 rounded-2xl">
                        <div>
                            <p className="font-black text-sm">Auto-refresh Dashboard</p>
                            <p className="text-[10px] opacity-50">Heartbeat monitoring for live orders</p>
                        </div>
                        <Switch.Root checked={settings.autoRefreshOrders} onCheckedChange={checked => setSettings({...settings, autoRefreshOrders: checked})} className="w-10 h-6 bg-muted rounded-full relative data-[state=checked]:bg-accent transition-colors">
                            <Switch.Thumb className="block w-4 h-4 bg-foreground rounded-full transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
                        </Switch.Root>
                    </div>
                    {settings.autoRefreshOrders && (
                        <input type="number" value={settings.refreshInterval} onChange={e => setSettings({...settings, refreshInterval: parseInt(e.target.value)})} className="w-full bg-input-background p-4 rounded-xl border border-border font-bold" />
                    )}
                </div>
            </section>
        </div>

        <div className="space-y-8">
             <section className="bg-card p-8 rounded-3xl border border-border space-y-6">
                <h2 className="text-xl font-black">Admin Whitelist</h2>
                <div className="flex gap-2">
                    <input type="email" placeholder="google-email@identity.com" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} className="flex-1 bg-input-background p-4 rounded-xl border border-border font-bold" />
                    <button onClick={handleAuthorizeEmail} className="px-6 bg-muted rounded-xl hover:bg-muted/80 transition-colors"><Plus className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                    {authorizedAdmins.map(email => (
                        <div key={email} className="flex justify-between items-center p-3 bg-muted/10 rounded-xl group border border-transparent hover:border-border">
                            <span className="text-sm font-bold opacity-70">{email}</span>
                            <button className="opacity-0 group-hover:opacity-100 text-destructive"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
            </section>

            <section className="bg-card p-8 rounded-3xl border border-border space-y-6">
                <h2 className="text-xl font-black text-destructive flex items-center gap-2"><ShieldAlert className="w-6 h-6" /> Security</h2>
                <div className="p-4 bg-destructive/5 rounded-2xl space-y-2 border border-destructive/10">
                    <label className="text-[10px] font-black uppercase text-destructive">Current Manager Password (required for pin updates)</label>
                    <input type="password" value={currentPasswordConfirm} onChange={e => setCurrentPasswordConfirm(e.target.value)} className="w-full bg-background p-3 rounded-lg border border-destructive/20 font-black text-center tracking-widest" />
                </div>
                <div className="space-y-4">
                    <div className="relative">
                        <input type="password" placeholder="Action PIN" value={actionPasswordInput} onChange={e => setActionPasswordInput(e.target.value)} className="w-full bg-input-background p-4 rounded-xl border border-border font-bold pr-20" />
                        <button onClick={() => handleUpdatePasswords('action')} className="absolute right-2 top-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-black">UPDATE</button>
                    </div>
                    <div className="relative">
                        <input type="password" placeholder="Staff Password" value={staffPasswordInput} onChange={e => setStaffPasswordInput(e.target.value)} className="w-full bg-input-background p-4 rounded-xl border border-border font-bold pr-20" />
                        <button onClick={() => handleUpdatePasswords('staff')} className="absolute right-2 top-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-black">UPDATE</button>
                    </div>
                </div>
            </section>
        </div>
      </div>
    </div>
  );
}
