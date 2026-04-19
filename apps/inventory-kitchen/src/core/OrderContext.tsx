import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "../../core/auth/AuthContext";

export interface Order {
  id: string;
  userId: string;
  userRollNo: string;
  items: { id: number; name: string; price: number; qty: number }[];
  totalPrice: number;
  status: "ordered" | "preparing" | "ready" | "completed" | "cancelled";
  slotName: string;
  slotTime: string;
  orderNumber: number;
  createdAt: string;
  updatedAt: string;
  // External orders only:
  isExternal?: boolean;
  externalLabel?: string;
  // Counter orders only:
  isCounterOrder?: boolean;
}

interface OrderContextType {
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  uncompletedOrdersCount: number;
  loading: boolean;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrdersState] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    let unsubscribe: () => void;
    import("../../app/services/rtdbService").then(({ rtdbService }) => {
      unsubscribe = rtdbService.subscribeActiveOrders((data) => {
        setOrdersState(data);
        setLoading(false);
      });
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated]);

  const setOrders = () => {
     console.warn("setOrders is deprecated with firestore. Mutate via addOrder, updateOrderStatus instead.");
  };
  
  // Calculate uncompleted orders (not picked up yet)
  const uncompletedOrdersCount = orders.filter(
    (order) => order.status !== "completed"
  ).length;

  return (
    <OrderContext.Provider value={{ orders, setOrders, uncompletedOrdersCount, loading }}>
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error("useOrders must be used within OrderProvider");
  }
  return context;
}
