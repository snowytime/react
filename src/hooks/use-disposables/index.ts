import { useState, useEffect } from "react";

import { disposables } from "#helpers/disposables/index.js";

export function useDisposables() {
    // Using useState instead of useRef so that we can use the initializer function.
    const [d] = useState(disposables);
    useEffect(() => () => d.dispose(), [d]);
    return d;
}
