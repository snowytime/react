import { useEffect, useMemo, useState } from "react";

export const useStore = <T, K>(initial: T, reducer: (state: T, action: K) => T) => {
    const listeners: Array<(state: T) => void> = useMemo(() => [], []);
    const [store, setStore] = useState(initial);
    useEffect(() => {
        listeners.push(setStore);
        return () => {
            const index = listeners.indexOf(setStore);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    }, [listeners, store]);

    // dispatcher
    const dispatch = (action: K) => {
        initial = reducer(initial, action);
        listeners.forEach((listener) => {
            listener(initial);
        });
    };

    return {
        store,
        dispatch,
    };
};
