import { useLayoutEffect, useEffect, EffectCallback, DependencyList } from "react";
import { env } from "#helpers/index.js";

export const useIsoMorphicEffect = (effect: EffectCallback, deps?: DependencyList | undefined) => {
    if (env.isServer) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(effect, deps);
    } else {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useLayoutEffect(effect, deps);
    }
};
