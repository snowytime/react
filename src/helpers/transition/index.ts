import { once } from "../once/index.js";
import { disposables } from "../disposables/index.js";
import { match } from "../match/index.js";

function addClasses(node: HTMLElement, ...classes: string[]) {
    if (!node || classes.length === 0) return;
    node.classList.add(...classes);
}

function removeClasses(node: HTMLElement, ...classes: string[]) {
    if (!node || classes.length === 0) return;
    node.classList.remove(...classes);
}

function waitForTransition(node: HTMLElement, done: () => void) {
    const d = disposables();

    if (!node) return d.dispose;

    // Safari returns a comma separated list of values, so let's sort them and take the highest value.
    const { transitionDuration, transitionDelay } = getComputedStyle(node);

    const [durationMs, delayMs] = [transitionDuration, transitionDelay].map((value) => {
        const [resolvedValue = 0] = value
            .split(",")
            // Remove falsy we can't work with
            .filter(Boolean)
            // Values are returned as `0.3s` or `75ms`
            .map((v) => (v.includes("ms") ? parseFloat(v) : parseFloat(v) * 1000))
            .sort((a, z) => z - a);

        return resolvedValue;
    });

    const totalDuration = durationMs + delayMs;

    if (totalDuration !== 0) {
        if (process.env.NODE_ENV === "test") {
            const dispose = d.setTimeout(() => {
                done();
                dispose();
            }, totalDuration);
        } else {
            d.group((val) => {
                // Mark the transition as done when the timeout is reached. This is a fallback in case the
                // transitionrun event is not fired.
                val.setTimeout(() => {
                    done();
                    val.dispose();
                }, totalDuration);

                // The moment the transitionrun event fires, we should cleanup the timeout fallback, because
                // then we know that we can use the native transition events because something is
                // transitioning.
                val.addEventListener(node, "transitionrun", (event) => {
                    if (event.target !== event.currentTarget) return;
                    val.dispose();
                });
            });

            const dispose = d.addEventListener(node, "transitionend", (event) => {
                if (event.target !== event.currentTarget) return;
                done();
                dispose();
            });
        }
    } else {
        // No transition is happening, so we should cleanup already. Otherwise we have to wait until we
        // get disposed.
        done();
    }

    // If we get disposed before the transition finishes, we should cleanup anyway.
    d.add(() => done());

    return d.dispose;
}

export function transition(
    node: HTMLElement,
    classes: {
        enter: string[];
        enterFrom: string[];
        enterTo: string[];
        leave: string[];
        leaveFrom: string[];
        leaveTo: string[];
        entered: string[];
    },
    show: boolean,
    done?: () => void,
) {
    const direction = show ? "enter" : "leave";
    const d = disposables();
    const _done = done !== undefined ? once(done) : () => {};

    // When using unmount={false}, when the element is "hidden", then we apply a `style.display =
    // 'none'` and a `hidden` attribute. Let's remove that in case we want to make an enter
    // transition. It can happen that React is removing this a bit too late causing the element to not
    // transition at all.
    if (direction === "enter") {
        node.removeAttribute("hidden");
        node.style.display = "";
    }

    const base = match(direction, {
        enter: () => classes.enter,
        leave: () => classes.leave,
    });
    const to = match(direction, {
        enter: () => classes.enterTo,
        leave: () => classes.leaveTo,
    });
    const from = match(direction, {
        enter: () => classes.enterFrom,
        leave: () => classes.leaveFrom,
    });

    removeClasses(
        node,
        ...classes.enter,
        ...classes.enterTo,
        ...classes.enterFrom,
        ...classes.leave,
        ...classes.leaveFrom,
        ...classes.leaveTo,
        ...classes.entered,
    );
    addClasses(node, ...base, ...from);

    d.nextFrame(() => {
        removeClasses(node, ...from);
        addClasses(node, ...to);

        waitForTransition(node, () => {
            removeClasses(node, ...base);
            addClasses(node, ...classes.entered);

            return _done();
        });
    });

    return d.dispose;
}
