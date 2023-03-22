export function omit<T extends Record<any, any>>(object: T, keysToOmit: string[] = []) {
    const clone = structuredClone(object) as T;
    keysToOmit.forEach((key) => {
        if (key in clone) delete clone[key];
    });
    return clone;
}
