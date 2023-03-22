import { Props } from "../types.js";

export function mergeProps(...listOfProps: Props<any, any>[]) {
    if (listOfProps.length === 0) return {};
    if (listOfProps.length === 1) return listOfProps[0];

    const target: Props<any, any> = {};

    const eventHandlers: Record<
        string,
        ((event: { defaultPrevented: boolean }, ...args: any[]) => void | undefined)[]
    > = {};

    // eslint-disable-next-line no-restricted-syntax
    for (const props of listOfProps) {
        // eslint-disable-next-line no-restricted-syntax
        for (const prop in props) {
            // Collect event handlers
            if (prop.startsWith("on") && typeof props[prop] === "function") {
                eventHandlers[prop] ??= [];
                eventHandlers[prop].push(props[prop]);
            } else {
                // Override incoming prop
                target[prop] = props[prop];
            }
        }
    }

    // Do not attach any event handlers when there is a `disabled` or `aria-disabled` prop set.
    if (target.disabled || target["aria-disabled"]) {
        return Object.assign(
            target,
            // Set all event listeners that we collected to `undefined`. This is
            // important because of the `cloneElement` from above, which merges the
            // existing and new props, they don't just override therefore we have to
            // explicitly nullify them.
            Object.fromEntries(
                Object.keys(eventHandlers).map((eventName) => [eventName, undefined]),
            ),
        );
    }

    // Merge event handlers
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const eventName in eventHandlers) {
        Object.assign(target, {
            [eventName](
                event: { nativeEvent?: Event; defaultPrevented: boolean },
                ...args: unknown[]
            ) {
                const handlers = eventHandlers[eventName];

                // eslint-disable-next-line no-restricted-syntax
                for (const handler of handlers) {
                    if (
                        (event instanceof Event || event?.nativeEvent instanceof Event) &&
                        event.defaultPrevented
                    ) {
                        return;
                    }

                    handler(event, ...args);
                }
            },
        });
    }

    return target;
}
