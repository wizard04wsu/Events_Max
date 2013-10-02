***********************************************************************************
* Events Max
* Enhanced cross-browser event handling
* 
* This work is licensed under a Creative Commons Attribution 3.0 Unported License
* http://creativecommons.org/licenses/by/3.0/
*
* Author: Andy Harrison, http://wizard04.me/
***********************************************************************************

Warning: this script will replace any previously defined `addEventHandler` or `removeEventHandler`

Cross-browser event registration functions
Works correctly across multiple windows/frames/iframes
Supports both capture and bubble phases
Handlers execute in FIFO order
Implements mouseenter, mouseleave, and DOMContentLoaded events (DOMContentLoaded degrades to readystatechange or load if it's not natively supported)
Standardizes and supplements the event object
Correctly handles nested events

addEventHandler(obj, type, handler[, useCapture])
removeEventHandler(obj, type, handler_or_guid[, useCapture])

Event types are case-sensitive and should not include "on" (e.g., use "click", not "onclick")

Usage examples:
  addEventHandler(element, "click", handlerFunction, true);
  removeEventHandler(element, "click", handlerFunction, true);
or:
  var handler_guid = addEventHandler(element, "click", function(evt){doSomething()});
  removeEventHandler(element, "click", handler_guid);

Custom mouse event attributes:

  event.mouse.button: the mouse button value for mousedown, mouseup, click, and dblclick events
						This goes by the Microsoft model, where left==1, right==2, and middle==4
						In IE lte 8, the value may be incorrect on mousedown since we can't reliably keep track of the event.button value between events.
						 (e.g., if the mouse leaves the window, buttons are changed by the user without the browser's detection, and the mouse comes back)
  event.mouse.position: object containing the mouse positions within the screen, window, document, and layer (e.g., evt.mouse.position.document.x)

Custom keyboard event attributes:

	Note: these may not be correct for some special keys in Opera (notably: home, end, insert, delete, num lock, scroll lock)
    event.keyboard.char: printed character or empty string
    event.keyboard.key: key value ("Control", "Down", "Tab", "F1", etc.), printed character, or "Unidentified"

	These are either the values determined above, or a "guess" derived from event.keyCode (assuming a US English QWERTY keyboard)
    event.keyboard.charGuess: printed character, guess based on event.keyCode, or empty string
    event.keyboard.keyGuess: key value ("Control", "Down", "Tab", "F1", etc.), printed character, guess based on event.keyCode, or "Unidentified"

There are a few custom attributes used by this script that must not be manipulated:
 ._handlerGUID on handler functions
 ._eventHandlers on DOM objects that have handlers assigned to them

Be aware that browsers act differently when the DOM is manipulated. Much of it seems to have to do with when the propagation path is
 determined for events (e.g., as soon as they're added to the event loop vs. just before they're dispatched).  Some fire mouseover/out
 events when an element is added/removed/positioned under the mouse, some stop bubbling an event if the currentTarget has been removed
 from the DOM, etc.

Techniques and inspiration largely from:
 http://dean.edwards.name/weblog/2005/10/add-event2/
 http://outofhanwell.wordpress.com/2006/07/03/cross-window-events/
 http://blog.metawrap.com/2005/10/24/ie-closures-leaks/
 http://www.quirksmode.org/js/events_properties.html
 http://javascript.info/tutorial/events-and-timing-depth
 http://dev.opera.com/articles/view/timing-and-synchronization-in-javascript/
