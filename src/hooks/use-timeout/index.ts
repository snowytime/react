import { MutableRefObject, useRef } from "react";

type Timeout = ReturnType<typeof setTimeout>;
export const useTimeout = () => {
    const timeout = useRef<Timeout | null>(null);
    const clear = (t: MutableRefObject<Timeout | null>) =>
        t.current ? clearTimeout(t.current) : null;
    const timeoutSetter = (cb: () => void, duration: number) => {
        timeout.current = setTimeout(cb, duration);
    };
    return { clear, timeout, timeoutSetter };
};
