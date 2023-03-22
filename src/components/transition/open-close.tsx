import React, { createContext, useContext, ReactNode, ReactElement } from "react";

export enum State {
    Open = 1 << 0,
    Closed = 1 << 1,
    Closing = 1 << 2,
    Opening = 1 << 3,
}

const Context = createContext<State | null>(null);
Context.displayName = "OpenClosedContext";

export function useOpenClosed() {
    return useContext(Context);
}

interface Props {
    value: State;
    children: ReactNode;
}

export const OpenClosedProvider = ({ value, children }: Props): ReactElement => {
    return <Context.Provider value={value}>{children}</Context.Provider>;
};
