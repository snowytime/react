import { useEffect } from "react";
import { useLatestValue } from "#hooks/use-latest-value/index.js";

export function useEventListener<TType extends keyof WindowEventMap>(
    element: HTMLElement | Document | Window | EventTarget,
    type: TType,
    listener: (event: WindowEventMap[TType]) => any,
    options?: boolean | AddEventListenerOptions,
) {
    const savedListener = useLatestValue(listener);

    useEffect(() => {
        const el = element || window;

        function handler(event: WindowEventMap[TType]) {
            savedListener.current(event);
        }

        el.addEventListener(type, handler as any, options);
        return () => el.removeEventListener(type, handler as any, options);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [element, type, options]);
}
