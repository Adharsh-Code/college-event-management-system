import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

const SCROLL_CONTAINERS = [".admin-main", ".coordinator-main", ".participant-main"];

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useLayoutEffect(() => {
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      SCROLL_CONTAINERS.forEach((selector) => {
        const element = document.querySelector(selector);
        if (element) {
          element.scrollTop = 0;
          element.scrollLeft = 0;
        }
      });
    };

    resetScroll();

    const frameId = window.requestAnimationFrame(() => {
      resetScroll();
    });

    const timeoutId = window.setTimeout(() => {
      resetScroll();
    }, 0);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [pathname, search]);

  return null;
}

export default ScrollToTop;
