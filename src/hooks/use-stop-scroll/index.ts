import { useEffect } from "react";
import { useScrollbarPreference } from "#hooks/use-scroll-preference/index.js";

export const useStopScroll = (condition: boolean) => {
    // gets the state of scrollbars existing
    const scrollbars = useScrollbarPreference();
    const disableScroll = () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        // disable scrolling by overwriting the default scroll behavior
        window.onscroll = () => {
            window.scrollTo(scrollLeft, scrollTop);
        };
    };
    const enableScroll = () => {
        window.onscroll = () => {
            // do nothing
        };
    };
    useEffect(() => {
        const { body } = document;
        const isMobile = window.innerWidth < 1000;
        if (condition) {
            if (isMobile) {
                body.classList.add("no-scroll");
            } else {
                disableScroll();
            }
        } else if (isMobile) {
            body.classList.remove("no-scroll");
        } else {
            enableScroll();
        }
    }, [scrollbars, condition]);
};
