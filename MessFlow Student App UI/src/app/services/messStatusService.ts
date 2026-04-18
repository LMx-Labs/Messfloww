import { rtdbService } from "./rtdbService";

export interface MessStatus {
  isOpen: boolean;
  currentlyServing: number;
}

export const messStatusService = {
  /**
   * Live subscription to the mess global status using RTDB.
   */
  subscribeToMessStatus(callback: (status: MessStatus) => void) {
    return rtdbService.subscribeMessStatus(callback);
  }
};
