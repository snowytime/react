import { useEffect } from "react";
import { useLatestValue } from "#hooks/use-latest-value/index.js";

export function useDocumentEvent<TType extends keyof DocumentEventMap>(
    type: TType,
    listener: (ev: DocumentEventMap[TType]) => any,
    options?: boolean | AddEventListenerOptions,
) {
    const listenerRef = useLatestValue(listener);

    useEffect(() => {
        function handler(event: DocumentEventMap[TType]) {
            listenerRef.current(event);
        }

        document.addEventListener(type, handler, options);
        return () => document.removeEventListener(type, handler, options);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, options]);
}
