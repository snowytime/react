export function mergeRefs(...refs: any[]) {
    return {
        ref: refs.every((ref) => ref == null)
            ? undefined
            : (value: any) => {
                  // eslint-disable-next-line no-restricted-syntax
                  for (const ref of refs) {
                      if (ref == null) continue;
                      if (typeof ref === "function") ref(value);
                      else ref.current = value;
                  }
              },
    };
}
