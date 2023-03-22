import React, {
    Fragment,
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,

    // Types
    ElementType,
    MutableRefObject,
    Ref,
} from "react";
import { Props, ReactTag } from "#helpers/types.js";
import {
    Features,
    forwardRefWithAs,
    HasDisplayName,
    PropsForFeatures,
    render,
    RenderStrategy,
    RefProp,
} from "#helpers/render/index.js";
import { OpenClosedProvider, State, useOpenClosed } from "./open-close.jsx";
import { match } from "#helpers/match/index.js";
import { useIsMounted } from "#hooks/use-is-mounted/index.js";
import { useIsoMorphicEffect } from "#hooks/use-isomorphic-effect/index.js";
import { useLatestValue } from "#hooks/use-latest-value/index.js";
import { useServerHandoffComplete } from "#hooks/use-server-handoff-complete/index.js";
import { useSyncRefs } from "#hooks/use-sync-refs/index.js";
import { useTransition } from "#hooks/use-transition/index.js";
import { useEvent } from "#hooks/use-event/index.js";
import { useDisposables } from "#hooks/use-disposables/index.js";
import { classNames } from "#helpers/class-names/index.js";
import { env } from "#helpers/env/index.js";
import { useFlags } from "#hooks/use-flags/index.js";

type ContainerElement = MutableRefObject<HTMLElement | null>;

type TransitionDirection = "enter" | "leave" | "idle";

const DEFAULT_TRANSITION_CHILD_TAG = "div" as const;
type TransitionChildRenderPropArg = MutableRefObject<HTMLDivElement>;
const TransitionChildRenderFeatures = Features.RenderStrategy;

function splitClasses(classes = "") {
    return classes.split(" ").filter((className) => className.trim().length > 1);
}

interface TransitionContextValues {
    show: boolean;
    appear: boolean;
    initial: boolean;
}
const TransitionContext = createContext<TransitionContextValues | null>(null);
TransitionContext.displayName = "TransitionContext";

enum TreeStates {
    Visible = "visible",
    Hidden = "hidden",
}

export interface TransitionClasses {
    enter?: string;
    enterFrom?: string;
    enterTo?: string;
    entered?: string;
    leave?: string;
    leaveFrom?: string;
    leaveTo?: string;
}

export interface TransitionEvents {
    beforeEnter?: () => void;
    afterEnter?: () => void;
    beforeLeave?: () => void;
    afterLeave?: () => void;
}

export type TransitionChildProps<TTag extends ReactTag> = Props<
    TTag,
    TransitionChildRenderPropArg,
    never,
    PropsForFeatures<typeof TransitionChildRenderFeatures> &
        TransitionClasses &
        TransitionEvents & { appear?: boolean }
>;

function useTransitionContext() {
    const context = useContext(TransitionContext);

    if (context === null) {
        throw new Error(
            "A <Transition.Child /> is used but it is missing a parent <Transition /> or <Transition.Root />.",
        );
    }

    return context;
}

interface NestingContextValues {
    children: MutableRefObject<{ el: ContainerElement; state: TreeStates }[]>;
    register: (el: ContainerElement) => () => void;
    unregister: (el: ContainerElement, strategy?: RenderStrategy) => void;
    onStart: (el: ContainerElement, direction: TransitionDirection, cb: () => void) => void;
    onStop: (el: ContainerElement, direction: TransitionDirection, cb: () => void) => void;
    chains: MutableRefObject<
        Record<TransitionDirection, [container: ContainerElement, promise: Promise<void>][]>
    >;
    wait: MutableRefObject<Promise<void>>;
}

const NestingContext = createContext<NestingContextValues | null>(null);

NestingContext.displayName = "NestingContext";

function useParentNesting() {
    const context = useContext(NestingContext);

    if (context === null) {
        throw new Error(
            "A <Transition.Child /> is used but it is missing a parent <Transition /> or <Transition.Root />.",
        );
    }

    return context;
}

function hasChildren(
    bag: NestingContextValues["children"] | { children: NestingContextValues["children"] },
): boolean {
    if ("children" in bag) return hasChildren(bag.children);
    return (
        bag.current
            .filter(({ el }) => el.current !== null)
            .filter(({ state }) => state === TreeStates.Visible).length > 0
    );
}

function useNesting(done?: () => void, parent?: NestingContextValues) {
    const doneRef = useLatestValue(done);
    const transitionableChildren = useRef<NestingContextValues["children"]["current"]>([]);
    const mounted = useIsMounted();
    const d = useDisposables();

    const unregister = useEvent((container: ContainerElement, strategy = RenderStrategy.Hidden) => {
        const idx = transitionableChildren.current.findIndex(({ el }) => el === container);
        if (idx === -1) return;

        match(strategy, {
            [RenderStrategy.Unmount]() {
                transitionableChildren.current.splice(idx, 1);
            },
            [RenderStrategy.Hidden]() {
                transitionableChildren.current[idx].state = TreeStates.Hidden;
            },
        });

        d.microTask(() => {
            if (!hasChildren(transitionableChildren) && mounted.current) {
                doneRef.current?.();
            }
        });
    });

    const register = useEvent((container: ContainerElement) => {
        const child = transitionableChildren.current.find(({ el }) => el === container);
        if (!child) {
            transitionableChildren.current.push({ el: container, state: TreeStates.Visible });
        } else if (child.state !== TreeStates.Visible) {
            child.state = TreeStates.Visible;
        }

        return () => unregister(container, RenderStrategy.Unmount);
    });

    const todos = useRef<(() => void)[]>([]);
    const wait = useRef<Promise<void>>(Promise.resolve());

    const chains = useRef<
        Record<TransitionDirection, [identifier: ContainerElement, promise: Promise<void>][]>
    >({
        enter: [],
        leave: [],
        idle: [],
    });

    const onStart = useEvent(
        (
            container: ContainerElement,
            direction: TransitionDirection,
            cb: (direction: TransitionDirection) => void,
        ) => {
            // Clear out all existing todos
            todos.current.splice(0);

            // Remove all existing promises for the current container from the parent because we can
            // ignore those and use only the new one.
            if (parent) {
                parent.chains.current[direction] = parent.chains.current[direction].filter(
                    ([containerInParent]) => containerInParent !== container,
                );
            }

            // Wait until our own transition is done
            parent?.chains.current[direction].push([
                container,
                new Promise<void>((resolve) => {
                    todos.current.push(resolve);
                }),
            ]);

            // Wait until our children are done
            parent?.chains.current[direction].push([
                container,
                new Promise<void>((resolve) => {
                    Promise.all(chains.current[direction].map(([_, promise]) => promise)).then(() =>
                        resolve(),
                    );
                }),
            ]);

            if (direction === "enter") {
                wait.current = wait.current
                    .then(() => parent?.wait.current)
                    .then(() => cb(direction));
            } else {
                cb(direction);
            }
        },
    );

    const onStop = useEvent(
        (
            _container: ContainerElement,
            direction: TransitionDirection,
            cb: (direction: TransitionDirection) => void,
        ) => {
            Promise.all(chains.current[direction].splice(0).map(([_, promise]) => promise)) // Wait for my children
                .then(() => {
                    todos.current.shift()?.(); // I'm ready
                })
                .then(() => cb(direction));
        },
    );

    return useMemo(
        () => ({
            children: transitionableChildren,
            register,
            unregister,
            onStart,
            onStop,
            wait,
            chains,
        }),
        [register, unregister, transitionableChildren, onStart, onStop, chains, wait],
    );
}

function noop() {}
const eventNames = ["beforeEnter", "afterEnter", "beforeLeave", "afterLeave"] as const;
function ensureEventHooksExist(events: TransitionEvents) {
    const result = {} as Record<keyof typeof events, () => void>;
    // eslint-disable-next-line no-restricted-syntax
    for (const name of eventNames) {
        result[name] = events[name] ?? noop;
    }
    return result;
}

function useEvents(events: TransitionEvents) {
    const eventsRef = useRef(ensureEventHooksExist(events));

    useEffect(() => {
        eventsRef.current = ensureEventHooksExist(events);
    }, [events]);

    return eventsRef;
}

const TransitionChildFn = <TTag extends ElementType = typeof DEFAULT_TRANSITION_CHILD_TAG>(
    props: TransitionChildProps<TTag>,
    ref: Ref<HTMLElement>,
) => {
    const {
        // Event "handlers"
        beforeEnter,
        afterEnter,
        beforeLeave,
        afterLeave,

        // Class names
        enter,
        enterFrom,
        enterTo,
        entered,
        leave,
        leaveFrom,
        leaveTo,
        ...rest
    } = props as typeof props;
    const container = useRef<HTMLElement | null>(null);
    const transitionRef = useSyncRefs(container, ref);
    const strategy = rest.unmount ? RenderStrategy.Unmount : RenderStrategy.Hidden;

    const { show, appear, initial } = useTransitionContext();

    const [state, setState] = useState(show ? TreeStates.Visible : TreeStates.Hidden);

    const parentNesting = useParentNesting();
    const { register, unregister } = parentNesting;
    const prevShow = useRef<boolean | null>(null);

    useEffect(() => register(container), [register, container]);

    useEffect(() => {
        // If we are in another mode than the Hidden mode then ignore
        if (strategy !== RenderStrategy.Hidden) return;
        if (!container.current) return;

        // Make sure that we are visible
        if (show && state !== TreeStates.Visible) {
            setState(TreeStates.Visible);
            return;
        }

        return match(state, {
            [TreeStates.Hidden]: () => unregister(container),
            [TreeStates.Visible]: () => register(container),
        });
    }, [state, container, register, unregister, show, strategy]);

    const classes = useLatestValue({
        enter: splitClasses(enter),
        enterFrom: splitClasses(enterFrom),
        enterTo: splitClasses(enterTo),
        entered: splitClasses(entered),
        leave: splitClasses(leave),
        leaveFrom: splitClasses(leaveFrom),
        leaveTo: splitClasses(leaveTo),
    });

    const events = useEvents({
        beforeEnter,
        afterEnter,
        beforeLeave,
        afterLeave,
    });

    const ready = useServerHandoffComplete();

    useEffect(() => {
        if (ready && state === TreeStates.Visible && container.current === null) {
            throw new Error("Did you forget to passthrough the `ref` to the actual DOM node?");
        }
    }, [container, state, ready]);

    // Skipping initial transition
    const skip = initial && !appear;

    const transitionDirection = (() => {
        if (!ready) return "idle";
        if (skip) return "idle";
        if (prevShow.current === show) return "idle";
        return show ? "enter" : "leave";
    })() as TransitionDirection;

    const transitionStateFlags = useFlags(0);

    const beforeEvent = useEvent((direction: TransitionDirection) => {
        return match(direction, {
            enter: () => {
                transitionStateFlags.addFlag(State.Opening);
                events.current.beforeEnter();
            },
            leave: () => {
                transitionStateFlags.addFlag(State.Closing);
                events.current.beforeLeave();
            },
            idle: () => {},
        });
    });

    const afterEvent = useEvent((direction: TransitionDirection) => {
        return match(direction, {
            enter: () => {
                transitionStateFlags.removeFlag(State.Opening);
                events.current.afterEnter();
            },
            leave: () => {
                transitionStateFlags.removeFlag(State.Closing);
                events.current.afterLeave();
            },
            idle: () => {},
        });
    });

    const nesting = useNesting(() => {
        // When all children have been unmounted we can only hide ourselves if and only if we are not
        // transitioning ourselves. Otherwise we would unmount before the transitions are finished.
        setState(TreeStates.Hidden);
        unregister(container);
    }, parentNesting);

    useTransition({
        container,
        classes,
        direction: transitionDirection,
        onStart: useLatestValue((direction) => {
            nesting.onStart(container, direction, beforeEvent);
        }),
        onStop: useLatestValue((direction) => {
            nesting.onStop(container, direction, afterEvent);

            if (direction === "leave" && !hasChildren(nesting)) {
                // When we don't have children anymore we can safely unregister from the parent and hide
                // ourselves.
                setState(TreeStates.Hidden);
                unregister(container);
            }
        }),
    });

    useEffect(() => {
        if (!skip) return;

        if (strategy === RenderStrategy.Hidden) {
            prevShow.current = null;
        } else {
            prevShow.current = show;
        }
    }, [show, skip, state, strategy]);

    let theirProps = rest;
    const ourProps = { ref: transitionRef };

    if (appear && show && env.isServer) {
        theirProps = {
            ...theirProps,
            // Already apply the `enter` and `enterFrom` on the server if required
            className: classNames(
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                rest.className,
                ...classes.current.enter,
                ...classes.current.enterFrom,
            ),
        };
    }

    return (
        <NestingContext.Provider value={nesting}>
            <OpenClosedProvider
                value={
                    match(state, {
                        [TreeStates.Visible]: State.Open,
                        [TreeStates.Hidden]: State.Closed,
                    }) | transitionStateFlags.flags
                }
            >
                {render({
                    ourProps,
                    theirProps,
                    defaultTag: DEFAULT_TRANSITION_CHILD_TAG,
                    features: TransitionChildRenderFeatures,
                    visible: state === TreeStates.Visible,
                    name: "Transition.Child",
                })}
            </OpenClosedProvider>
        </NestingContext.Provider>
    );
};

export type TransitionRootProps<TTag extends ElementType> = TransitionChildProps<TTag> & {
    show?: boolean;
    appear?: boolean;
};

const TransitionRootFn = <TTag extends ElementType = typeof DEFAULT_TRANSITION_CHILD_TAG>(
    props: TransitionRootProps<TTag>,
    ref: Ref<HTMLElement>,
) => {
    let { show } = props;
    const { appear = false, unmount, ...theirProps } = props as typeof props;
    const internalTransitionRef = useRef<HTMLElement | null>(null);
    const transitionRef = useSyncRefs(internalTransitionRef, ref);

    // The TransitionChild will also call this hook, and we have to make sure that we are ready.
    useServerHandoffComplete();

    const usesOpenClosedState = useOpenClosed();

    if (show === undefined && usesOpenClosedState !== null) {
        show = (usesOpenClosedState & State.Open) === State.Open;
    }

    if (![true, false].includes(show as unknown as boolean)) {
        throw new Error("A <Transition /> is used but it is missing a `show={true | false}` prop.");
    }

    const [state, setState] = useState(show ? TreeStates.Visible : TreeStates.Hidden);

    const nestingBag = useNesting(() => {
        setState(TreeStates.Hidden);
    });

    const [initial, setInitial] = useState(true);

    // Change the `initial` value
    const changes = useRef([show]);
    useIsoMorphicEffect(() => {
        // We can skip this effect
        if (initial === false) {
            return;
        }

        // Track the changes
        if (changes.current[changes.current.length - 1] !== show) {
            changes.current.push(show);
            setInitial(false);
        }
    }, [changes, show]);

    const transitionBag = useMemo<TransitionContextValues>(
        () => ({ show: show as boolean, appear, initial }),
        [show, appear, initial],
    );

    useEffect(() => {
        if (show) {
            setState(TreeStates.Visible);
        } else if (!hasChildren(nestingBag)) {
            setState(TreeStates.Hidden);
        } else if (
            process.env.NODE_ENV !==
            "test" /* TODO: Remove this once we have real tests! JSDOM doesn't "render", therefore getBoundingClientRect() will always result in `0`. */
        ) {
            const node = internalTransitionRef.current;
            if (!node) return;
            const rect = node.getBoundingClientRect();

            if (rect.x === 0 && rect.y === 0 && rect.width === 0 && rect.height === 0) {
                // The node is completely hidden, let's hide it
                setState(TreeStates.Hidden);
            }
        }
    }, [show, nestingBag]);

    const sharedProps = { unmount };

    return (
        <NestingContext.Provider value={nestingBag}>
            <TransitionContext.Provider value={transitionBag}>
                {render({
                    ourProps: {
                        ...sharedProps,
                        as: Fragment,
                        children: (
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore
                            <TransitionChild ref={transitionRef} {...sharedProps} {...theirProps} />
                        ),
                    },
                    theirProps: {},
                    defaultTag: Fragment,
                    features: TransitionChildRenderFeatures,
                    visible: state === TreeStates.Visible,
                    name: "Transition",
                })}
            </TransitionContext.Provider>
        </NestingContext.Provider>
    );
};

const ChildFn = <TTag extends ElementType = typeof DEFAULT_TRANSITION_CHILD_TAG>(
    props: TransitionChildProps<TTag>,
    ref: MutableRefObject<HTMLElement>,
) => {
    const hasTransitionContext = useContext(TransitionContext) !== null;
    const hasOpenClosedContext = useOpenClosed() !== null;

    return (
        <>
            {!hasTransitionContext && hasOpenClosedContext ? (
                <TransitionRoot ref={ref} {...props} />
            ) : (
                <TransitionChild ref={ref} {...props} />
            )}
        </>
    );
};

interface ComponentTransitionRoot extends HasDisplayName {
    <TTag extends ElementType = typeof DEFAULT_TRANSITION_CHILD_TAG>(
        props: TransitionRootProps<TTag> & RefProp<typeof TransitionRootFn>,
    ): JSX.Element;
}

interface ComponentTransitionChild extends HasDisplayName {
    <TTag extends ElementType = typeof DEFAULT_TRANSITION_CHILD_TAG>(
        props: TransitionChildProps<TTag> & RefProp<typeof TransitionChildFn>,
    ): JSX.Element;
}

const TransitionRoot = forwardRefWithAs(TransitionRootFn) as unknown as ComponentTransitionRoot;
const TransitionChild = forwardRefWithAs(TransitionChildFn) as unknown as ComponentTransitionChild;
const Child = forwardRefWithAs(ChildFn) as unknown as ComponentTransitionChild;

export const Transition = Object.assign(TransitionRoot, { Child, Root: TransitionRoot });
