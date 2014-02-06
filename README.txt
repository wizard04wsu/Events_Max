Cross-browser event registration functions
Works correctly across multiple windows/frames/iframes
Supports both capture and bubble phases
Handlers execute in FIFO order
Implements mouseenter, mouseleave, and DOMContentLoaded events
Standardizes and supplements the event object
Correctly handles nested events

addEventHandler(obj, type, handler[, useCapture])
removeEventHandler(obj, type, handler_or_guid[, useCapture])

See the script file itself (events_max.js) for details.
