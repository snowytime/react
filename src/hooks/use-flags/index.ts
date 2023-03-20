import { useState, useCallback } from "react";
import { useIsMounted } from "#hooks/use-is-mounted/index.js";

export function useFlags(initialFlags = 0) {
    const [flags, setFlags] = useState(initialFlags);
    const mounted = useIsMounted();

    const addFlag = useCallback(
        (flag: number) => {
            if (!mounted.current) return;
            setFlags((f) => f | flag);
        },
        [mounted],
    );
    const hasFlag = useCallback((flag: number) => Boolean(flags & flag), [flags]);
    const removeFlag = useCallback(
        (flag: number) => {
            if (!mounted.current) return;
            setFlags((f) => f & ~flag);
        },
        [setFlags, mounted],
    );
    const toggleFlag = useCallback(
        (flag: number) => {
            if (!mounted.current) return;
            setFlags((f) => f ^ flag);
        },
        [setFlags, mounted],
    );

    return { flags, addFlag, hasFlag, removeFlag, toggleFlag };
}
