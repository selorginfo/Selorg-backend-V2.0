/**
 * React 19 / Next 16 stream runtime ($RS = completeSegment) can throw
 * "Cannot read properties of null (reading 'parentNode')" when a Suspense
 * placeholder was already removed (hydration recovery, extensions, etc.).
 * See https://github.com/facebook/react/issues/35056 — swallow the unsafe
 * assign and keep a null-safe implementation until React ships the fix.
 */
(function () {
  function completeSegment(segmentId, placeholderId) {
    var segment = document.getElementById(segmentId);
    var placeholder = document.getElementById(placeholderId);
    if (
      !segment ||
      !placeholder ||
      !segment.parentNode ||
      !placeholder.parentNode
    ) {
      return;
    }
    for (
      segment.parentNode.removeChild(segment);
      segment.firstChild;

    ) {
      placeholder.parentNode.insertBefore(segment.firstChild, placeholder);
    }
    placeholder.parentNode.removeChild(placeholder);
  }

  try {
    Object.defineProperty(window, "$RS", {
      configurable: true,
      enumerable: false,
      get: function () {
        return completeSegment;
      },
      set: function () {
        /* ignore React's unsafe inline assign */
      },
    });
  } catch {
    window.$RS = completeSegment;
  }
})();
