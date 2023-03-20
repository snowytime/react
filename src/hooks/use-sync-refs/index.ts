import { useRef, useEffect } from "react";
import { useEvent } from "#hooks/use-event/index.js";

// eslint-disable-next-line symbol-description
const Optional = Symbol();

export function optionalRef<T>(cb: (ref: T) => void, isOptional = true) {
    return Object.assign(cb, { [Optional]: isOptional });
}

export function useSyncRefs<TType>(
    ...refs: (React.MutableRefObject<TType | null> | ((instance: TType) => void) | null)[]
) {
    const cache = useRef(refs);

    useEffect(() => {
        cache.current = refs;
    }, [refs]);

    const syncRefs = useEvent((value: TType) => {
        // eslint-disable-next-line no-restricted-syntax
        for (const ref of cache.current) {
            if (ref == null) continue;
            if (typeof ref === "function") ref(value);
            else ref.current = value;
        }
    });

    return refs.every((ref) => ref == null || ref?.[Optional]) ? undefined : syncRefs;
}
