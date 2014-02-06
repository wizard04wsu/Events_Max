Events Max
=====

Enhanced cross-browser JavaScript event handling

- Cross-browser event registration functions  
- Works correctly across multiple windows/frames/iframes  
- Supports both capture and bubble phases  
- Handlers execute in FIFO order  
- Implements mouseenter, mouseleave, and DOMContentLoaded events  
- Standardizes and supplements the event object  
- Correctly handles nested events

=====

**addEventHandler()**

Registers an event handler on an object.

**`addEventHandler(obj, type, handler[, useCapture])`**

- `obj`  
  The DOM object listening for the event.

- `type`  
  Event type. Event types are case-sensitive and should not include "on" (e.g., use "click", not "onclick").

- `handler`  
  Function used to handle the event.

- `useCapture` (optional)  
  If true, the handler will be executed during the capture phase. Otherwise, the bubble phase.

Returns a GUID (an integer) to identify the handler. This allows a handler to be removed by simply providing the GUID--even anonymous functions.

=====

**removeEventHandler()**

Removes an event handler that is registered on an object.

**`removeEventHandler(obj, type, handler_or_guid[, useCapture])`**

- `obj`  
  The DOM object listening for the event.

- `type`  
  Event type. Event types are case-sensitive and should not include "on" (e.g., use "click", not "onclick").

- `handler_or_guid`  
  Either the handler itself to be removed, or the GUID of the handler.

- `useCapture` (optional)  
  If true, remove the handler from the capture phase. Otherwise, remove it from the bubble phase.

=====

**Custom mouse event attributes**

- **`evt.mouse.button`**  
  The mouse button value for mousedown, mouseup, click, and dblclick events.
  
  This goes by the Microsoft model, where left==1, right==2, and middle==4.  
  In IE lte 8, the value may be incorrect on mousedown since we can't reliably keep track of the event.button value between events. (e.g., if the mouse leaves the window, buttons are changed by the user without the browser's detection, and the mouse comes back)

- **`evt.mouse.position`**  
  Object containing the mouse positions within the screen, window, document, and layer (e.g., `evt.mouse.position.document.x`).

=====

**Custom keyboard event attributes**

- **`evt.keyboard.char`**  
  Printed character or empty string

- **`evt.keyboard.key`**  
  Key value ("Control", "Down", "Tab", "F1", etc.), printed character, or "Unidentified"

Note that these may not be correct for some special keys in Opera (notably: home, end, insert, delete, num lock, scroll lock).

**Keyboard guesses**

These are either the values determined above, or a "guess" derived from `evt.keyCode` (assuming a US English QWERTY keyboard).

- **`evt.keyboard.charGuess`**  
  Printed character, guess based on `evt.keyCode`, or empty string

- **`evt.keyboard.keyGuess`**  
  Key value ("Control", "Down", "Tab", "F1", etc.), printed character, guess based on `evt.keyCode`, or "Unidentified"

=====

**Custom drag & drop event attributes**

- **`evt.draggingExternal`**  
  `true` if an object external to the viewport is being dragged (e.g., a file, bookmark, or browser tab)

=====

**Additional information**

There are a few custom attributes used by this script that must not be manipulated; they end with a space to make it less likely that they will be messed with:  
   `["handlerGUID "]` on handler functions  
   `["eventHandlers "]` on DOM objects that have handlers assigned to them

Be aware that browsers act differently when the DOM is manipulated. Much of it seems to have to do with when the propagation path is determined for events (e.g., as soon as they're added to the event loop vs. just before they're dispatched). Some fire mouseover/out events when an element is added/removed/positioned under the mouse, some stop bubbling an event if the currentTarget has been removed from the DOM, etc.

=====

**General references**

Techniques and inspiration largely from:  
- http://dean.edwards.name/weblog/2005/10/add-event2/  
- http://outofhanwell.wordpress.com/2006/07/03/cross-window-events/  
- http://blog.metawrap.com/2005/10/24/ie-closures-leaks/  
- http://www.quirksmode.org/js/events_properties.html  
- http://javascript.info/tutorial/events-and-timing-depth  
- http://dev.opera.com/articles/view/timing-and-synchronization-in-javascript/  



