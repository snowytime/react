import {
    Fragment,
    cloneElement,
    createElement,
    forwardRef,
    isValidElement,

    // Types
    ElementType,
    ReactElement,
    Ref,
} from "react";
import { Props, XOR, __, Expand } from "../types.js";
import { classNames } from "../class-names/index.js";
import { match } from "../match/index.js";
import { mergeProps } from "../merge-props/index.js";
import { mergeRefs } from "../merge-refs/index.js";
import { omit } from "../omit/index.js";
import { compact } from "../compact/index.js";

// eslint-disable-next-line no-shadow
export enum Features {
    /** No features at all */
    None = 0,

    /**
     * When used, this will allow us to use one of the render strategies.
     *
     * **The render strategies are:**
     *    - **Unmount**   _(Will unmount the component.)_
     *    - **Hidden**    _(Will hide the component using the [hidden] attribute.)_
     */
    RenderStrategy = 1,

    /**
     * When used, this will allow the user of our component to be in control. This can be used when
     * you want to transition based on some state.
     */
    Static = 2,
}

// eslint-disable-next-line no-shadow
export enum RenderStrategy {
    Unmount,
    Hidden,
}

type PropsForFeature<TPassedInFeatures extends Features, TForFeature extends Features, TProps> = {
    [P in TPassedInFeatures]: P extends TForFeature ? TProps : __;
}[TPassedInFeatures];

export type PropsForFeatures<T extends Features> = XOR<
    PropsForFeature<T, Features.Static, { static?: boolean }>,
    PropsForFeature<T, Features.RenderStrategy, { unmount?: boolean }>
>;

function _render<TTag extends ElementType, TSlot>(
    props: Props<TTag, TSlot> & { ref?: unknown },
    slot: TSlot,
    tag: ElementType,
    name: string,
) {
    const {
        as: Component = tag,
        children,
        refName = "ref",
        ...rest
    } = omit(props, ["unmount", "static"]);

    // This allows us to use `<HeadlessUIComponent as={MyComponent} refName="innerRef" />`
    const refRelatedProps = props.ref !== undefined ? { [refName]: props.ref } : {};

    const resolvedChildren = (typeof children === "function" ? children(slot) : children) as
        | ReactElement
        | ReactElement[];

    // Allow for className to be a function with the slot as the contents
    if ("className" in rest && rest.className && typeof rest.className === "function") {
        rest.className = rest.className(slot);
    }

    const dataAttributes: Record<string, string> = {};
    if (slot) {
        let exposeState = false;
        const states: string[] = [];
        // eslint-disable-next-line no-restricted-syntax
        for (const [k, v] of Object.entries(slot)) {
            if (typeof v === "boolean") {
                exposeState = true;
            }
            if (v === true) {
                states.push(k);
            }
        }

        if (exposeState) dataAttributes[`data-headlessui-state`] = states.join(" ");
    }

    if (Component === Fragment) {
        if (Object.keys(compact(rest)).length > 0) {
            if (
                !isValidElement(resolvedChildren) ||
                (Array.isArray(resolvedChildren) && resolvedChildren.length > 1)
            ) {
                throw new Error(
                    [
                        'Passing props on "Fragment"!',
                        "",
                        `The current component <${name} /> is rendering a "Fragment".`,
                        `However we need to passthrough the following props:`,
                        Object.keys(rest)
                            .map((line) => `  - ${line}`)
                            .join("\n"),
                        "",
                        "You can apply a few solutions:",
                        [
                            'Add an `as="..."` prop, to ensure that we render an actual element instead of a "Fragment".',
                            "Render a single element as the child so that we can forward the props onto that element.",
                        ]
                            .map((line) => `  - ${line}`)
                            .join("\n"),
                    ].join("\n"),
                );
            }

            // Merge class name prop in SSR
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore We know that the props may not have className. It'll be undefined then which is fine.
            const newClassName = classNames(resolvedChildren.props?.className, rest.className);
            const classNameProps = newClassName ? { className: newClassName } : {};

            return cloneElement(resolvedChildren, {
                ...mergeProps(resolvedChildren.props as any, compact(omit(rest, ["ref"]))),
                ...dataAttributes,
                ...refRelatedProps,
                ...mergeRefs((resolvedChildren as any).ref, refRelatedProps.ref),
                ...classNameProps,
            });
        }
    }

    return createElement(
        Component,
        {
            ...omit(rest, ["ref"]),
            ...(Component !== Fragment && refRelatedProps),
            ...(Component !== Fragment && dataAttributes),
        },
        resolvedChildren,
    );
}

export function render<TFeature extends Features, TTag extends ElementType, TSlot>({
    ourProps,
    theirProps,
    slot,
    defaultTag,
    features,
    visible = true,
    name,
}: {
    ourProps: Expand<Props<TTag, TSlot, any> & PropsForFeatures<TFeature>> & {
        ref?: Ref<HTMLElement | ElementType>;
    };
    theirProps: Expand<Props<TTag, TSlot, any>>;
    slot?: TSlot;
    defaultTag: ElementType;
    features?: TFeature;
    visible?: boolean;
    name: string;
}) {
    const props = mergeProps(theirProps, ourProps);

    // Visible always render
    if (visible) return _render(props, slot, defaultTag, name);

    const featureFlags = features ?? Features.None;

    if (featureFlags & Features.Static) {
        const { static: isStatic = false, ...rest } = props as PropsForFeatures<Features.Static>;

        // When the `static` prop is passed as `true`, then the user is in control, thus we don't care about anything else
        if (isStatic) return _render(rest, slot, defaultTag, name);
    }

    if (featureFlags & Features.RenderStrategy) {
        const { unmount = true, ...rest } = props as PropsForFeatures<Features.RenderStrategy>;
        const strategy = unmount ? RenderStrategy.Unmount : RenderStrategy.Hidden;

        return match(strategy, {
            [RenderStrategy.Unmount]() {
                return null;
            },
            [RenderStrategy.Hidden]() {
                return _render(
                    { ...rest, ...{ hidden: true, style: { display: "none" } } },
                    slot,
                    defaultTag,
                    name,
                );
            },
        });
    }

    // No features enabled, just render
    return _render(props, slot, defaultTag, name);
}

export type HasDisplayName = {
    displayName: string;
};

export type RefProp<T extends Function> = T extends (props: any, ref: Ref<infer RefType>) => any
    ? { ref?: Ref<RefType> }
    : never;

/**
 * This is a hack, but basically we want to keep the full 'API' of the component, but we do want to
 * wrap it in a forwardRef so that we _can_ passthrough the ref
 */
export function forwardRefWithAs<T extends { name: string; displayName?: string }>(
    component: T,
): T & { displayName: string } {
    return Object.assign(forwardRef(component as unknown as any) as any, {
        displayName: component.displayName ?? component.name,
    });
}
