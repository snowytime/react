export function compact<T extends Record<any, any>>(object: T) {
    const clone = structuredClone(object);
    // eslint-disable-next-line no-restricted-syntax
    for (const key in clone) {
        if (clone[key] === undefined) delete clone[key];
    }
    return clone;
}
