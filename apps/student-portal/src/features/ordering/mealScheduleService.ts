import { doc, getDoc } from "firebase/firestore";
import { db } from "@messflow/shared-core";

export interface MealSlotInfo {
  items: string[];
  time: string;
}

export interface DaySchedule {
  breakfast: MealSlotInfo;
  lunch: MealSlotInfo;
  snacks: MealSlotInfo;
  dinner: MealSlotInfo;
}

export const mealScheduleService = {
  /**
   * Fetches the meal schedule for a specific day of the week.
   * @param day 'monday', 'tuesday', etc.
   */
  async getDaySchedule(day: string): Promise<DaySchedule | null> {
    const docRef = doc(db, "mealSchedule", day.toLowerCase());
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as DaySchedule;
    }
    
    return null;
  }
};
