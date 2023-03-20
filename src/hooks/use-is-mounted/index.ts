import { useRef } from "react";
import { useIsoMorphicEffect } from "#hooks/use-isomorphic-effect/index.js";

export function useIsMounted() {
    const mounted = useRef(false);

    useIsoMorphicEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
        };
    }, []);

    return mounted;
}
