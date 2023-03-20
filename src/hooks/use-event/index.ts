import React from "react";
import { useLatestValue } from "#hooks/use-latest-value/index.js";

export const useEvent = function useEvent<
    F extends (...args: any[]) => any,
    P extends any[] = Parameters<F>,
    R = ReturnType<F>,
>(cb: (...args: P) => R) {
    const cache = useLatestValue(cb);
    return React.useCallback((...args: P) => cache.current(...args), [cache]);
};
