import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface UpdatePreferencesStore {
  autoCheck: boolean;
  showChangelog: boolean;
  setAutoCheck: (autoCheck: boolean) => void;
  setShowChangelog: (showChangelog: boolean) => void;
}

const useUpdatePreferencesStore = create<UpdatePreferencesStore>()(
  persist(
    (set) => ({
      autoCheck: true,
      showChangelog: true,
      setAutoCheck: (autoCheck) => set({ autoCheck }),
      setShowChangelog: (showChangelog) => set({ showChangelog }),
    }),
    {
      name: "potsuboverlay-update-preferences",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useUpdatePreferencesStore;

