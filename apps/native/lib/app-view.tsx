import * as React from "react";

export type AppViewMode = "admin" | "customer";

type AppViewContextValue = {
  viewMode: AppViewMode;
  setViewMode: (mode: AppViewMode) => void;
};

const AppViewContext = React.createContext<AppViewContextValue | null>(null);

export function AppViewProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewMode] = React.useState<AppViewMode>("admin");

  return (
    <AppViewContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </AppViewContext.Provider>
  );
}

export function useAppView() {
  const context = React.useContext(AppViewContext);
  if (!context) {
    throw new Error("useAppView must be used inside AppViewProvider");
  }
  return context;
}
