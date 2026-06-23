"use client";

import { createContext, useContext } from "react";

export const RefreshContext = createContext({ refreshKey: 0, triggerRefresh: () => {} });
export const useRefresh = () => useContext(RefreshContext);
