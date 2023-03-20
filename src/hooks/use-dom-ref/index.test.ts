import test from "ava";
import { renderHook, act } from "@testing-library/react";
import { JSDOM } from "jsdom";
import { useDomRef } from "./index.js";

test("Should be null if element is not rendered", (t) => {
    const dom = new JSDOM();
    global.window = dom.window;
    global.document = dom.window.document;

    const { result } = renderHook(() => useDomRef<HTMLElement>());
    t.is(result.current[0], null);

    act(() => {
        result.current[1](document.body);
    });

    // Assert that the ref value has been updated
    t.is(result.current[0], document.body);

    // Cleanup the global document object
    global.document = undefined;
});
