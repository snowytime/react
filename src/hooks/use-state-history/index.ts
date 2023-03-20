import { useEffect, useRef } from "react";

export const useStateHistory = <T>(state: T, count = 3) => {
    const history = useRef<T[]>([]);
    useEffect(() => {
        if (history.current.at(-1) === state) {
            return;
        }
        history.current.push(state);
        // we only want the count thats shown to be set
    }, [state]);
    return history.current.slice(~count);
};
