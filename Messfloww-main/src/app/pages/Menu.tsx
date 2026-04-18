import { useState, useRef, useMemo, useEffect } from "react";
import { Link } from "react-router";
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Power, 
  Download, 
  Upload, 
  X, 
  Check, 
  AlertTriangle,
  FileText,
  AlertCircle
} from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Switch from "@radix-ui/react-switch";
import { useMenu, MealType, MenuItem } from "../context/MenuContext";
import { parseMenuCSV, downloadMenuTemplate, CSVParseResult } from "../utils/csvParser";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { useTimeSlots } from "../context/TimeSlotContext";

export function Menu() {
  const { 
    menu, 
    setMenu, 
    lowStockItems, 
    outOfStockItems 
  } = useMenu();
  const { role } = useAuth();
  const { timeSlots } = useTimeSlots();
  
  const slotNames = useMemo(() => timeSlots.map(s => s.name.toLowerCase()), [timeSlots]);

  const [activeTab, setActiveTab] = useState<string>("");
  
  // Set initial active tab when timeSlots load
  useEffect(() => {
    if (slotNames.length > 0 && !activeTab) {
      setActiveTab(slotNames[0]);
    }
  }, [slotNames, activeTab]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  // CSV Upload States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [parseResult, setParseResult] = useState<CSVParseResult<MenuItem> | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCategory, setItemCategory] = useState("Main Course");
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [itemGst, setItemGst] = useState("5");
  const [itemIsMRP, setItemIsMRP] = useState(false);
  const [itemStock, setItemStock] = useState("0");
  const [itemMinStock, setItemMinStock] = useState("0");
  
  const [stockValue, setStockValue] = useState("");
  const [minStockValue, setMinStockValue] = useState("");

  const [dismissedLowStockAlerts, setDismissedLowStockAlerts] = useState<number[]>([]);

  const filteredMenuItems = useMemo(() => {
    const items = menu[activeTab] || [];
    return items.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [menu, activeTab, searchTerm]);

  const toggleAvailability = async (mealType: MealType, itemId: number) => {
    const item = menu[mealType].find(i => i.id === itemId);
    if (item) {
      const { rtdbService } = await import("../services/rtdbService");
      await rtdbService.setMenuStock(itemId, { 
        stock: item.stock,
        minStock: item.minStock,
        available: !item.available 
      });
    }
  };

  const deleteItem = async (mealType: MealType, itemId: number) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      const { deleteMenuItem } = await import("../services/firestoreService");
      await deleteMenuItem(itemId);
    }
  };

  const resetForm = () => {
    setItemName("");
    setItemPrice("");
    setItemCategory("Main Course");
    setItemIsVeg(true);
    setItemGst("5");
    setItemIsMRP(false);
    setEditingItemId(null);
    setItemStock("0");
    setItemMinStock("0");
  };

  const handleConfirmAddItem = async () => {
    if (itemName.trim() && itemPrice && parseInt(itemPrice) > 0) {
      const { addMenuItem } = await import("../services/firestoreService");
      const nStock = parseInt(itemStock) || 0;
      const nMinStock = parseInt(itemMinStock) || 0;

      const newItem: MenuItem = {
        id: Date.now(),
        name: itemName.trim(),
        price: parseInt(itemPrice),
        available: true,
        isVeg: itemIsVeg,
        category: itemCategory,
        slot: activeTab,
        gst: parseInt(itemGst) || 0,
        isMRP: itemIsMRP,
        stock: nStock,
        initialStock: nStock,
        minStock: nMinStock,
        lowStockAlert: false,
      };
      await addMenuItem(newItem);
      const { rtdbService } = await import("../services/rtdbService");
      await rtdbService.setMenuStock(newItem.id, {
        stock: nStock,
        minStock: nMinStock,
        available: nStock > nMinStock
      });
      setShowAddModal(false);
      resetForm();
    }
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemPrice(item.price.toString());
    setItemCategory(item.category);
    setItemIsVeg(item.isVeg);
    setItemGst(item.gst.toString());
    setItemIsMRP(item.isMRP);
    setShowEditModal(true);
  };

  const handleConfirmEditItem = async () => {
    if (itemName.trim() && itemPrice && parseInt(itemPrice) > 0 && editingItemId) {
      const { updateMenuItem } = await import("../services/firestoreService");
      await updateMenuItem(editingItemId, { 
          name: itemName.trim(), 
          price: parseInt(itemPrice), 
          isVeg: itemIsVeg, 
          category: itemCategory,
          gst: parseInt(itemGst) || 0,
          isMRP: itemIsMRP
      });
      setShowEditModal(false);
      resetForm();
    }
  };

  const handleOpenStockModal = (mealType: MealType, itemId: number) => {
    const item = menu[mealType].find((i) => i.id === itemId);
    if (item) {
      setActiveTab(mealType);
      setEditingItemId(itemId);
      setStockValue(item.stock.toString());
      setMinStockValue(item.minStock.toString());
      setShowStockModal(true);
    }
  };

  const handleSaveStock = async () => {
    if (editingItemId !== null) {
      const newStock = parseInt(stockValue) || 0;
      const newMinStock = parseInt(minStockValue) || 0;
      
      const { updateMenuItem } = await import("../services/firestoreService");
      const { rtdbService } = await import("../services/rtdbService");
      // Update metadata in Firestore
      await updateMenuItem(editingItemId, { 
          initialStock: newStock, 
          minStock: newMinStock,
          stock: newStock
      });
      // Update live stock in RTDB
      await rtdbService.setMenuStock(editingItemId, {
          stock: newStock,
          minStock: newMinStock,
          available: newStock > newMinStock 
      });
      setShowStockModal(false);
    }
  };

  const handleDismissLowStockAlert = (itemId: number) => {
    setDismissedLowStockAlerts(prev => [...prev, itemId]);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "text/csv") {
      processFile(file);
    }
  };

  // CSV Upload Logic
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseMenuCSV(text);
      setParseResult(result);
    };
    reader.readAsText(file);
  };

  const handleConfirmUpload = async () => {
    if (parseResult && parseResult.valid.length > 0) {
      const { batchReplaceMenuSlot } = await import("../services/firestoreService");
      
      // confirmed decision: Replace All
      // For menu, we'll replace the slots that have data in the CSV
      const slotsInCSV = Array.from(new Set(parseResult.valid.map(item => item.slot)));
      
      for (const slot of slotsInCSV) {
        const itemsInSlot = parseResult.valid.filter(item => item.slot === slot);
        await batchReplaceMenuSlot(slot, itemsInSlot);
      }

      setShowUploadModal(false);
      setParseResult(null);
    }
  };

  const downloadMenuReport = () => {
    let csvContent = "MessFlow Menu Management Report\n";
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    (Object.keys(menu) as MealType[]).forEach(mealType => {
      csvContent += `\n=== ${mealType.toUpperCase()} ===\n`;
      csvContent += "Item Name,Category,Price,GST,MRP,Stock,Status\n";
      
      menu[mealType].forEach(item => {
        csvContent += `"${item.name}",${item.category},₹${item.price},${item.gst}%,${item.isMRP ? 'Yes' : 'No'},${item.stock},${item.available ? 'Available' : 'Unavailable'}\n`;
      });
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `MessFlow_Menu_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Menu Management</h1>
          <p className="text-muted-foreground">Manage dishes, pricing, and availability across meal slots</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={downloadMenuReport}
            className="bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors"
          >
            <Download className="h-5 w-5" />
            Download Report
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors"
          >
            <Upload className="h-5 w-5" />
            Upload CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors shadow-md"
          >
            <Plus className="h-5 w-5" />
            Add New Item
          </button>
        </div>
      </div>

      {/* Stock Alerts Bar */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lowStockItems.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-yellow-600 font-bold mb-2">
                <AlertTriangle className="h-5 w-5" />
                Low Stock Warning ({lowStockItems.length})
              </div>
              <div className="space-y-2">
                {lowStockItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-semibold">
                      {item.name} <span className="text-muted-foreground capitalize">({item.slot})</span>
                    </span>
                    <span className="text-yellow-600 font-bold">{item.stock} units left</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {outOfStockItems.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-600 font-bold mb-2">
                <AlertCircle className="h-5 w-5" />
                Out of Stock ({outOfStockItems.length})
              </div>
              <div className="space-y-2">
                {outOfStockItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-semibold">
                      {item.name} <span className="text-muted-foreground capitalize">({item.slot})</span>
                    </span>
                    <span className="text-red-600 font-bold">DISABLED</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search and Tabs */}
      <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as MealType)}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <Tabs.List className="flex bg-muted p-1 rounded-xl w-fit overflow-x-auto max-w-full no-scrollbar">
            {slotNames.map((slot) => (
              <Tabs.Trigger
                key={slot}
                value={slot}
                className="px-6 py-2 rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm capitalize whitespace-nowrap"
              >
                {slot}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search dishes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-card text-foreground pl-11 pr-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            />
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMenuItems.length === 0 ? (
            <div className="col-span-full">
              <EmptyState 
                icon={FileText}
                title={`No items in ${activeTab}`}
                description="Add a new item or upload a CSV to see dishes in this meal slot."
                action={role === 'manager' ? {
                  label: "Add New Item",
                  onClick: () => setShowAddModal(true)
                } : undefined}
              />
            </div>
          ) : (
            filteredMenuItems.map((item) => {
              const finalPrice = Math.round(item.price * (1 + (item.gst || 0) / 100));
              return (
              <div
                key={item.id}
                className={`bg-card rounded-2xl overflow-hidden border transition-all hover:shadow-lg ${
                  !item.available ? "border-destructive/30 grayscale-[0.5]" : "border-border"
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                    <div
                      className={`h-4 w-4 rounded-sm border flex items-center justify-center p-0.5 ${
                        item.isVeg ? "border-green-600" : "border-red-600"
                      }`}
                    >
                      <div
                        className={`h-full w-full rounded-full ${
                          item.isVeg ? "bg-green-600" : "bg-red-600"
                        }`}
                      />
                    </div>
                    {item.isMRP && (
                      <span className="bg-blue-500/10 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/20">
                        MRP
                      </span>
                    )}
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded">
                      {item.category}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-1">{item.name}</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex flex-col">
                      <p className="text-2xl font-bold text-foreground">
                        {item.isMRP ? `MRP ₹${item.price}` : `₹${item.price}`}
                      </p>
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        Final: ₹{finalPrice} (Incl. {item.gst}% GST)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      Stock: 
                      <span className={`px-2 py-0.5 rounded ${
                        item.stock <= item.minStock 
                          ? "bg-red-500 text-white" 
                          : item.stock <= 20 
                          ? "bg-yellow-500 text-white" 
                          : "bg-muted text-foreground"
                      }`}>
                        {item.stock} units
                      </span>
                    </div>
                    <button
                      onClick={() => handleOpenStockModal(activeTab, item.id)}
                      className="text-xs text-primary hover:underline font-bold"
                    >
                      SET STOCK
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleEditItem(item)}
                        className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                        title="Edit Item"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteItem(activeTab, item.id)}
                        className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                        title="Delete Item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${item.available ? "text-green-600" : "text-destructive"}`}>
                        {item.available ? "AVAILABLE" : "UNAVAILABLE"}
                      </span>
                      <Switch.Root
                        checked={item.available}
                        onCheckedChange={() => toggleAvailability(activeTab, item.id)}
                        className="w-10 h-5 bg-muted rounded-full relative data-[state=checked]:bg-accent transition-colors"
                      >
                        <Switch.Thumb className="block w-4 h-4 bg-foreground rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[21px]" />
                      </Switch.Root>
                    </div>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>
      </Tabs.Root>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-8 w-full max-w-lg border border-border shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                {showAddModal ? `Add Item to ${activeTab}` : 'Edit Item'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  resetForm();
                }}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Item Name</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Masala Dosa"
                  className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Price (₹)</label>
                  <input
                    type="number"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="0"
                    className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">GST (%)</label>
                  <select
                    value={itemGst}
                    onChange={(e) => setItemGst(e.target.value)}
                    className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Category</label>
                  <input
                    type="text"
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    placeholder="e.g. Main Course"
                    className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="block text-sm font-semibold text-foreground mb-2">Priced on MRP?</label>
                   <div className="flex items-center gap-3 pt-3">
                    <span className="text-sm">No</span>
                    <Switch.Root
                      checked={itemIsMRP}
                      onCheckedChange={setItemIsMRP}
                      className="w-10 h-5 bg-muted rounded-full relative data-[state=checked]:bg-blue-500 transition-colors"
                    >
                      <Switch.Thumb className="block w-4 h-4 bg-foreground rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[21px]" />
                    </Switch.Root>
                    <span className="text-sm">Yes</span>
                  </div>
                </div>
              </div>

              {showAddModal && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Initial Stock</label>
                    <input
                      type="number"
                      value={itemStock}
                      onChange={(e) => setItemStock(e.target.value)}
                      placeholder="0"
                      className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Min Stock Threshold</label>
                    <input
                      type="number"
                      value={itemMinStock}
                      onChange={(e) => setItemMinStock(e.target.value)}
                      placeholder="0"
                      className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={itemIsVeg}
                    onChange={() => setItemIsVeg(true)}
                    className="w-4 h-4 text-primary accent-primary"
                  />
                  <span className="text-foreground font-semibold">Veg</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!itemIsVeg}
                    onChange={() => setItemIsVeg(false)}
                    className="w-4 h-4 text-primary accent-primary"
                  />
                  <span className="text-foreground font-semibold">Non-Veg</span>
                </label>
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    resetForm();
                  }}
                  className="flex-1 bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={showAddModal ? handleConfirmAddItem : handleConfirmEditItem}
                  className="flex-1 bg-primary hover:bg-secondary text-primary-foreground px-6 py-3 rounded-xl font-semibold transition-colors shadow-md"
                >
                  {showAddModal ? "Add Dish" : "Update Dish"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Modal */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-8 w-full max-w-md border border-border shadow-2xl">
            <h2 className="text-2xl font-bold text-foreground mb-6">Manage Stock</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Available Quantity</label>
                <input
                  type="number"
                  value={stockValue}
                  onChange={(e) => setStockValue(e.target.value)}
                  className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Minimum Stock Threshold (Auto-off)</label>
                <input
                  type="number"
                  value={minStockValue}
                  onChange={(e) => setMinStockValue(e.target.value)}
                  className="w-full bg-input-background text-foreground px-4 py-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground py-2">
                When stock reaches or goes below the minimum threshold, the item is auto-disabled and hidden from customers.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowStockModal(false)}
                  className="flex-1 bg-muted text-foreground px-6 py-3 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStock}
                  className="flex-1 bg-accent text-accent-foreground px-6 py-3 rounded-xl font-semibold shadow-md"
                >
                  Update Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-border shadow-2xl flex flex-col">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Upload Menu CSV</h2>
                <p className="text-sm text-muted-foreground">Import items for all meal slots</p>
              </div>
              <button onClick={() => { setShowUploadModal(false); setParseResult(null); }} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <X className="h-6 w-6 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!parseResult ? (
                <div 
                  onDragOver={onDragOver} 
                  onDragLeave={() => setIsDragOver(false)} 
                  onDrop={onDrop}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${isDragOver ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <Upload className="h-10 w-10 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Drag and drop menu CSV</h3>
                  <p className="mb-8 opacity-70 italic text-sm">Valid slots: {slotNames.join(', ')}</p>
                  
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                  <div className="flex gap-4 justify-center">
                    <button onClick={() => fileInputRef.current?.click()} className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold">Browse Files</button>
                    <button onClick={downloadMenuTemplate} className="text-primary font-bold flex items-center gap-2"><Download className="h-5 w-5" /> Template</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="flex items-center justify-between gap-4 p-4 bg-muted rounded-xl border border-border">
                    <div className="flex gap-6 font-semibold">
                      <span>{parseResult.valid.length} items parsed</span>
                      {parseResult.errors.length > 0 && <span className="text-red-500">{parseResult.errors.length} errors</span>}
                    </div>
                    <button onClick={() => setParseResult(null)} className="text-sm text-primary font-bold">Clear and re-upload</button>
                  </div>
                  {/* Slot Validation Warning */}
                  {parseResult.valid.some(item => !slotNames.includes(item.slot.toLowerCase())) && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-amber-500 font-bold text-sm">Slot Name Mismatch Detected</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Some items in your CSV use slot names that aren't defined in your <Link to="/settings" className="text-primary hover:underline">Time Slots</Link>. 
                          These items will be saved but won't be visible to students until a matching Time Slot is created.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {Array.from(new Set(parseResult.valid
                            .map(i => i.slot.toLowerCase())
                            .filter(s => !slotNames.includes(s))
                          )).map(s => (
                            <span key={s} className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-500/20 uppercase">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {slotNames.map(slot => {
                      const slotItems = parseResult.valid.filter(i => i.slot.toLowerCase() === slot);
                      if (slotItems.length === 0) return null;
                      return (
                        <div key={slot} className="border border-border rounded-xl p-4">
                          <h4 className="font-bold border-b border-border mb-3 pb-2 capitalize">{slot} ({slotItems.length})</h4>
                          <div className="text-sm space-y-1">
                            {slotItems.slice(0, 5).map((item, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="truncate">{item.name}</span>
                                <span className="font-bold">₹{item.price}</span>
                              </div>
                            ))}
                            {slotItems.length > 5 && <div className="text-xs opacity-50">+{slotItems.length - 5} more...</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border bg-muted/30 flex justify-between items-center">
              <span className="text-xs opacity-70">Note: Import will replace existing items in the slots present in CSV</span>
              <div className="flex gap-3">
                <button onClick={() => { setShowUploadModal(false); setParseResult(null); }} className="bg-muted px-6 py-3 rounded-xl font-semibold">Cancel</button>
                <button 
                  onClick={handleConfirmUpload} 
                  disabled={!parseResult || parseResult.valid.length === 0}
                  className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-semibold shadow-md disabled:opacity-50"
                >
                  Import Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Low Stock Alerts for Quick Action */}
      {lowStockItems.map(item => (
        !dismissedLowStockAlerts.includes(item.id) && (
          <div key={item.id} className="fixed bottom-6 right-6 bg-red-500 text-red-50 px-6 py-4 rounded-xl shadow-lg border-2 border-red-500 flex items-center gap-3 animate-slide-up z-50">
            <div className="p-2 bg-red-500/20 rounded-full">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <span className="font-semibold">Low stock for {item.name} in {item.slot}</span>
            <button
              onClick={() => handleOpenStockModal(item.slot, item.id)}
              className="ml-3 bg-red-500/20 text-red-500 px-3 py-1 rounded-full hover:bg-red-500 hover:text-red-50"
            >
              Set Stock
            </button>
            <button
              onClick={() => handleDismissLowStockAlert(item.id)}
              className="ml-3 bg-red-500/20 text-red-500 px-3 py-1 rounded-full hover:bg-red-500 hover:text-red-50"
            >
              Dismiss
            </button>
          </div>
        )
      ))}
    </div>
  );
}