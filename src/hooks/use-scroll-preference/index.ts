import { useEffect, useState } from "react";

export const useScrollbarPreference = () => {
    const [state, setState] = useState<null | boolean>(null);
    useEffect(() => {
        const windowWidth = window.innerWidth;
        const docWidth = document.body.offsetWidth;
        setState(windowWidth !== docWidth);
    }, []);
    return state;
};
