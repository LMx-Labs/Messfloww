import { kitchenService } from "../../features/kitchen/kitchenService";
import { kotQueueService } from "../../features/kitchen/kotQueueService";

export const rtdbService = {
  ...kitchenService,
  ...kotQueueService,
};
