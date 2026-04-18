import { useState, useEffect } from "react";
import { Save, RefreshCw, AlertCircle, CheckCircle2, ShieldAlert, Plus, Trash2, Mail } from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import { fetchSettings, saveSettings, saveActionPassword, saveStaffPassword, fetchRoles, saveRoles } from "../services/firestoreService";
import { auth } from "../../lib/firebase";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";

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

export function Settings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionPasswordInput, setActionPasswordInput] = useState("");
  const [managerPasswordInput, setManagerPasswordInput] = useState("");
  const [staffPasswordInput, setStaffPasswordInput] = useState("");
  const [currentPasswordConfirm, setCurrentPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [authorizedAdmins, setAuthorizedAdmins] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");

  const reauthenticate = async () => {
    if (!auth.currentUser || !auth.currentUser.email) throw new Error("No user logged in");
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPasswordConfirm);
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  const handleSaveActionPassword = async () => {
    if (actionPasswordInput.trim() && currentPasswordConfirm.trim()) {
      try {
        setPasswordError("");
        await reauthenticate();
        await saveActionPassword(btoa(actionPasswordInput.trim()));
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        setActionPasswordInput("");
        setCurrentPasswordConfirm("");
      } catch (e: any) {
        console.error("Failed to save action password", e);
        setPasswordError(e.message || "Authentication failed. Incorrect current password.");
      }
    }
  };

  const handleSaveManagerPassword = async () => {
    if (managerPasswordInput.trim() && currentPasswordConfirm.trim()) {
      try {
        setPasswordError("");
        await reauthenticate();
        await updatePassword(auth.currentUser!, managerPasswordInput.trim());
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        setManagerPasswordInput("");
        setCurrentPasswordConfirm("");
      } catch (e: any) {
        console.error("Failed to update manager password", e);
        setPasswordError(e.message || "Failed to update manager password");
      }
    }
  };

  const handleSaveStaffPassword = async () => {
    if (staffPasswordInput.trim() && currentPasswordConfirm.trim()) {
      try {
        setPasswordError("");
        await reauthenticate();
        await saveStaffPassword(btoa(staffPasswordInput.trim()));
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        setStaffPasswordInput("");
        setCurrentPasswordConfirm("");
      } catch (e: any) {
        console.error("Failed to update staff password", e);
        setPasswordError(e.message || "Failed to update staff password");
      }
    }
  };

  // Load settings on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [remoteSettings, roles] = await Promise.all([
          fetchSettings(),
          fetchRoles()
        ]);
        
        if (remoteSettings) {
          setSettings(remoteSettings as any);
        }
        if (roles) {
          setAuthorizedAdmins(roles.authorized_admins || []);
        }
      } catch (e) {
        console.error("Failed to fetch settings from Firestore", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSave = async () => {
    try {
      await saveSettings(settings);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  };

  const handleReset = async () => {
    if (confirm("Are you sure you want to reset to default settings?")) {
      try {
        setSettings(defaultSettings);
        await saveSettings(defaultSettings);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } catch (e) {
        console.error("Failed to reset settings", e);
      }
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Configure system preferences and defaults</p>
        </div>
        {showSuccess && (
          <div className="flex items-center gap-2 text-accent font-bold animate-in fade-in slide-in-from-right-4">
            <CheckCircle2 className="h-5 w-5" />
            Saved
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* General Settings */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <h2 className="text-xl font-bold text-foreground mb-6">General Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Mess Name
                </label>
                <input
                  type="text"
                  value={settings.messName}
                  onChange={(e) => setSettings({ ...settings, messName: e.target.value })}
                  className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Admin Email
                </label>
                <input
                  type="email"
                  value={settings.adminEmail}
                  onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
                  className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Order Settings */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <h2 className="text-xl font-bold text-foreground mb-6">Order Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-semibold text-foreground">Auto-refresh Orders</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically refresh order dashboard
                  </p>
                </div>
                <Switch.Root
                  checked={settings.autoRefreshOrders}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, autoRefreshOrders: checked })
                  }
                  className="w-12 h-6 bg-muted rounded-full relative data-[state=checked]:bg-accent transition-colors shadow-inner"
                >
                  <Switch.Thumb className="block w-5 h-5 bg-foreground rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[26px]" />
                </Switch.Root>
              </div>

              {settings.autoRefreshOrders && (
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Refresh Interval (seconds)
                  </label>
                  <input
                    type="number"
                    value={settings.refreshInterval}
                    onChange={(e) =>
                      setSettings({ ...settings, refreshInterval: parseInt(e.target.value) || 10 })
                    }
                    min="10"
                    max="120"
                    className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Maximum Order Amount (₹)
                </label>
                <input
                  type="number"
                  value={settings.maxOrderAmount}
                  onChange={(e) =>
                    setSettings({ ...settings, maxOrderAmount: parseInt(e.target.value) || 0 })
                  }
                  className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Payment Settings */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <h2 className="text-xl font-bold text-foreground mb-6">Payment & Balance</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-semibold text-foreground">Enable Wallet Top-up</p>
                  <p className="text-xs text-muted-foreground">
                    Allow students to add money to wallet
                  </p>
                </div>
                <Switch.Root
                  checked={settings.enableWalletTopup}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, enableWalletTopup: checked })
                  }
                  className="w-12 h-6 bg-muted rounded-full relative data-[state=checked]:bg-accent transition-colors shadow-inner"
                >
                  <Switch.Thumb className="block w-5 h-5 bg-foreground rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[26px]" />
                </Switch.Root>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Minimum Balance Alert (₹)
                </label>
                <input
                  type="number"
                  value={settings.minBalance}
                  onChange={(e) =>
                    setSettings({ ...settings, minBalance: parseInt(e.target.value) || 0 })
                  }
                  className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={settings.taxRate}
                  onChange={(e) =>
                    setSettings({ ...settings, taxRate: parseFloat(e.target.value) || 0 })
                  }
                  min="0"
                  max="100"
                  step="0.5"
                  className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Receipt & Billing Template */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <h2 className="text-xl font-bold text-foreground mb-6">Receipt & Billing Template</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Business Address
                </label>
                <input
                  type="text"
                  value={settings.receiptAddress || ""}
                  onChange={(e) => setSettings({ ...settings, receiptAddress: e.target.value })}
                  placeholder="Street name, City, Zip"
                  className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  GST Number
                </label>
                <input
                  type="text"
                  value={settings.receiptGstNumber || ""}
                  onChange={(e) => setSettings({ ...settings, receiptGstNumber: e.target.value })}
                  placeholder="Optional"
                  className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-sm font-mono text-sm uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  FSSAI License Number
                </label>
                <input
                  type="text"
                  value={settings.receiptFssaiNumber || ""}
                  onChange={(e) => setSettings({ ...settings, receiptFssaiNumber: e.target.value })}
                  placeholder="Optional"
                  className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-sm font-mono text-sm uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Footer Message
                </label>
                <input
                  type="text"
                  value={settings.receiptFooterMessage || ""}
                  onChange={(e) => setSettings({ ...settings, receiptFooterMessage: e.target.value })}
                  placeholder="e.g. Thanks for your visit"
                  className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-sm italic"
                />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <h2 className="text-xl font-bold text-foreground mb-6">Notifications</h2>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-semibold text-foreground">Enable Notifications</p>
                <p className="text-xs text-muted-foreground">
                  Receive alerts for new orders and updates
                </p>
              </div>
              <Switch.Root
                checked={settings.enableNotifications}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, enableNotifications: checked })
                }
                className="w-12 h-6 bg-muted rounded-full relative data-[state=checked]:bg-accent transition-colors shadow-inner"
              >
                <Switch.Thumb className="block w-5 h-5 bg-foreground rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[26px]" />
              </Switch.Root>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              <p className="font-semibold mb-1">Important</p>
              <p className="text-muted-foreground">
                Changes to critical settings may affect system performance. Please review carefully
                before saving.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Access Management */}
      <div className="bg-card rounded-xl p-6 border border-border shadow-sm mt-6">
        <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
          <Mail className="h-6 w-6 text-primary" />
          Admin Access Whitelist
        </h2>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Only the Google accounts listed below will be granted access to this Admin Portal. 
            <span className="text-destructive font-bold ml-1">Students are strictly prohibited.</span>
          </p>

          <div className="flex gap-2">
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="Google email of admin"
              className="flex-1 bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            />
            <button
              onClick={async () => {
                if (newAdminEmail.trim()) {
                  const email = newAdminEmail.trim().toLowerCase();
                  if (!authorizedAdmins.includes(email)) {
                    const newList = [...authorizedAdmins, email];
                    setAuthorizedAdmins(newList);
                    await saveRoles({ authorized_admins: newList });
                    setNewAdminEmail("");
                    setShowSuccess(true);
                    setTimeout(() => setShowSuccess(false), 3000);
                  }
                }
              }}
              disabled={!newAdminEmail}
              className="bg-primary hover:bg-secondary text-primary-foreground px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Authorize Email
            </button>
          </div>

          <div className="mt-6 space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Whitelisted Admins:</h3>
            {authorizedAdmins.length === 0 ? (
              <p className="text-sm text-muted-foreground italic bg-muted/30 p-3 rounded-lg">No custom admins added yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {authorizedAdmins.map((email) => (
                  <div key={email} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group border border-transparent hover:border-border transition-colors">
                    <span className="text-sm text-foreground font-medium truncate">{email}</span>
                    <button
                      onClick={async () => {
                        if (confirm(`Revoke admin access for ${email}?`)) {
                          const newList = authorizedAdmins.filter(e => e !== email);
                          setAuthorizedAdmins(newList);
                          await saveRoles({ authorized_admins: newList });
                        }
                      }}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Password Management */}
      <div className="bg-card rounded-xl p-6 border border-border shadow-sm mt-6">
        <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          Legacy Password Settings
        </h2>
        
        <div className="space-y-6 max-w-md">
          {/* Current Password Validation */}
          <div className="p-4 bg-muted/30 border border-border rounded-xl mb-6">
            <label className="block text-sm font-bold text-destructive mb-2">
              Authentication Required
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Enter your current password to modify legacy role passwords.
            </p>
            <input
              type="password"
              value={currentPasswordConfirm}
              onChange={(e) => setCurrentPasswordConfirm(e.target.value)}
              placeholder="Current password"
              className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            />
            {passwordError && (
               <p className="text-sm text-destructive mt-2 font-semibold">{passwordError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Action PIN (B64)</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={actionPasswordInput}
                onChange={(e) => setActionPasswordInput(e.target.value)}
                placeholder="New PIN"
                className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border shadow-sm"
              />
              <button
                onClick={handleSaveActionPassword}
                disabled={!actionPasswordInput || !currentPasswordConfirm}
                className="bg-primary hover:bg-secondary text-primary-foreground px-4 py-2 rounded-lg font-bold disabled:opacity-50"
              >
                Update
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <label className="block text-sm font-semibold text-foreground mb-2">Manager Password</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={managerPasswordInput}
                onChange={(e) => setManagerPasswordInput(e.target.value)}
                placeholder="New password"
                className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border shadow-sm"
              />
              <button
                onClick={handleSaveManagerPassword}
                disabled={!managerPasswordInput || !currentPasswordConfirm}
                className="bg-primary hover:bg-secondary text-primary-foreground px-4 py-2 rounded-lg font-bold disabled:opacity-50"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 pt-6">
        <button
          onClick={handleSave}
          className="flex-1 bg-primary hover:bg-secondary text-primary-foreground px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
        >
          <Save className="h-6 w-6" />
          Save Preferences
        </button>
        <button
          onClick={handleReset}
          className="bg-muted hover:bg-muted/80 text-foreground px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          <RefreshCw className="h-6 w-6" />
          Reset Defaults
        </button>
      </div>
    </div>
  );
}
