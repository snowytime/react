import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";

export const useStore = <T>(initial: T, listeners: Dispatch<SetStateAction<T>>[]) => {
    const [store, setStore] = useState(initial);
    useEffect(() => {
        listeners.push(setStore);
        return () => {
            const index = listeners.indexOf(setStore);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    }, [store, listeners]);

    return {
        ...store,
    };
};
