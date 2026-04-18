import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../core/firebase';
import { BillDocument } from './types';

export function useBill(billId: string) {
  const [bill, setBill] = useState<BillDocument | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!billId) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'bills', billId);
    
    setLoading(true);
    const unsubscribe = onSnapshot(docRef, 
      (snapshot) => {
        if (snapshot.exists()) {
          setBill({ billId: snapshot.id, ...snapshot.data() } as BillDocument);
        } else {
          setError(new Error('Bill not found'));
        }
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [billId]);

  return { bill, loading, error };
}
