import { useState, useMemo, Dispatch } from "react";

export const useDomRef = <T>(): [T, Dispatch<T>] => {
    const [ref, _setRef] = useState<T | null>(null);
    const setRef = useMemo(() => _setRef, []);
    return [ref, setRef];
};
