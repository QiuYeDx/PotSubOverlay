import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface NotificationStore {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const useNotificationStore = create<NotificationStore>()(
  persist(
    (set) => ({
      enabled: true,
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: "potsuboverlay-notification",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useNotificationStore;

