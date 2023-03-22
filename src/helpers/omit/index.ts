export const omit = <T extends Record<any, any>>(object: T, keysToOmit: string[] = []) => {
    const clone = Object.assign({}, object) as T;
    for (const key of keysToOmit) {
        if (key in clone) delete clone[key];
    }
    return clone;
};
