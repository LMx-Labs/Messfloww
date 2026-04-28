import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export function useOfflineQueue<T>(queueKey: string, syncFunction: (item: T) => Promise<void>) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queue, setQueue] = useState<T[]>([]);

  useEffect(() => {
    // One-time cleanup: purge the legacy 'offline_orders_cache' key that was used
    // in older builds. It has been superseded by the Cloud Function order flow.
    localStorage.removeItem('offline_orders_cache');

    const savedQueue = JSON.parse(localStorage.getItem(queueKey) || '[]');
    setQueue(savedQueue);

    const handleOnline = () => {
      setIsOffline(false);
      flushQueue();
    };
    
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      flushQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queueKey]);

  const flushQueue = useCallback(async () => {
    const savedQueue = JSON.parse(localStorage.getItem(queueKey) || '[]');
    if (savedQueue.length === 0) return;

    toast.info(`Syncing ${savedQueue.length} offline items...`);
    let syncedCount = 0;
    
    // We try to sync items one by one. If one fails (e.g. due to actual internet loss mid-sync), 
    // we stop and keep the rest in the queue.
    const remainingQueue = [...savedQueue];
    
    for (const item of savedQueue) {
      try {
        await syncFunction(item);
        syncedCount++;
        remainingQueue.shift(); // Remove the successfully synced item
      } catch (e) {
        console.error("Failed to sync item", e);
        break; // Stop syncing if we hit an error (likely network)
      }
    }
    
    localStorage.setItem(queueKey, JSON.stringify(remainingQueue));
    setQueue(remainingQueue);
    
    if (syncedCount > 0) {
      toast.success(`Synced ${syncedCount} offline items successfully!`);
    }
  }, [queueKey, syncFunction]);

  const enqueue = useCallback((item: T) => {
    const currentQueue = JSON.parse(localStorage.getItem(queueKey) || '[]');
    currentQueue.push(item);
    localStorage.setItem(queueKey, JSON.stringify(currentQueue));
    setQueue(currentQueue);
  }, [queueKey]);

  return { isOffline, queue, enqueue, flushQueue, pendingCount: queue.length };
}
