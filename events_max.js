/*****************************************
 * Events Max
 * Enhanced cross-browser event handling
 * 
 * This work is licensed under a Creative Commons Attribution 3.0 Unported License
 * http://creativecommons.org/licenses/by/3.0/
 *
 * Author: Andy Harrison, http://wizard04.me/
 *****************************************/

//Warning: this will replace any previously defined `addEventHandler` or `removeEventHandler`

//Cross-browser event registration functions
//Works correctly across multiple windows/frames/iframes
//Supports both capture and bubble phases
//Handlers execute in FIFO order
//Implements mouseenter, mouseleave, and DOMContentLoaded events (DOMContentLoaded degrades to readystatechange or load if it's not natively supported)
//Standardizes and supplements the event object
//Correctly handles nested events

//addEventHandler(obj, type, handler[, useCapture])
//removeEventHandler(obj, type, handler_or_guid[, useCapture])
//
//Event types are case-sensitive and should not include "on" (e.g., use "click", not "onclick")
//
//Usage examples:
//  addEventHandler(element, "click", handlerFunction, true);
//  removeEventHandler(element, "click", handlerFunction, true);
//or:
//  var handler_guid = addEventHandler(element, "click", function(evt){doSomething()});
//  removeEventHandler(element, "click", handler_guid);

//Custom mouse event attributes:
//
//  event.mouse.button: the mouse button value for mousedown, mouseup, click, and dblclick events
//						This goes by the Microsoft model, where left==1, right==2, and middle==4
//						In IE lte 8, the value may be incorrect on mousedown since we can't reliably keep track of the event.button value between events.
//						 (e.g., if the mouse leaves the window, buttons are changed by the user without the browser's detection, and the mouse comes back)
//  event.mouse.position: object containing the mouse positions within the screen, window, document, and layer (e.g., evt.mouse.position.document.x)
//
//Custom keyboard event attributes:
//
//	//Note: these may not be correct for some special keys in Opera (notably: home, end, insert, delete, num lock, scroll lock)
//  event.keyboard.char: printed character or empty string
//  event.keyboard.key: key value ("Control", "Down", "Tab", "F1", etc.), printed character, or "Unidentified"
//
//	//These are either the values determined above, or a "guess" derived from event.keyCode (assuming a US English QWERTY keyboard)
//  event.keyboard.charGuess: printed character, guess based on event.keyCode, or empty string
//  event.keyboard.keyGuess: key value ("Control", "Down", "Tab", "F1", etc.), printed character, guess based on event.keyCode, or "Unidentified"

//There are a few custom attributes used by this script that must not be manipulated:
// ._handlerGUID on handler functions
// ._eventHandlers on DOM objects that have handlers assigned to them

//Be aware that browsers act differently when the DOM is manipulated. Much of it seems to have to do with when the propagation path is
// determined for events (e.g., as soon as they're added to the event loop vs. just before they're dispatched).  Some fire mouseover/out
// events when an element is added/removed/positioned under the mouse, some stop bubbling an event if the currentTarget has been removed
// from the DOM, etc.

//Techniques and inspiration largely from:
// http://dean.edwards.name/weblog/2005/10/add-event2/
// http://outofhanwell.wordpress.com/2006/07/03/cross-window-events/
// http://blog.metawrap.com/2005/10/24/ie-closures-leaks/
// http://www.quirksmode.org/js/events_properties.html
// http://javascript.info/tutorial/events-and-timing-depth
// http://dev.opera.com/articles/view/timing-and-synchronization-in-javascript/


(function (){
	
	"use strict";
	
	var newGUID, windows;
	
	newGUID = 1;	//GUID to assign to the next event handler function without one
	
	//event stack & flags for each window
	//the event stack is required because of nested events
	// see http://javascript.info/tutorial/events-and-timing-depth#nested-dom-events-are-synchronous
	windows = [];
	function windowInfo(windowObj){
		var i;
		for(i=0; i<windows.length; i++){
			if(windows[i].window === windowObj) return windows[i];
		}
		windows.push({ window:windowObj, eventStack:[], handlerDepth:0 });
		return windows[i];
	}
	
	
	window.addEventHandler = addEventHandler;
	window.removeEventHandler = removeEventHandler;
	
	
	/*** event handler registration ***/
	
	function addEventHandler(obj, type, handler, useCapture){
		
		var ownerWindow, winInfo, phase;
		
		type = ""+type;
		
		ownerWindow = getOwnerWindow(obj);
		
		if(!ownerWindow){
			//Unable to determine the window in which obj resides; most likely, obj is not a DOM element
			throw new TypeError("Invalid argument for addEventHandler(): obj");
		}
		
		if(!(/^[a-z][0-9a-z]*$/i).test(type)){
			throw new TypeError("Invalid argument for addEventHandler(): type");
		}
		if(typeof(handler) !== "function"){
			throw new TypeError("Invalid argument for addEventHandler(): handler");
		}
		
		winInfo = windowInfo(ownerWindow);
		
		//make sure the object's window flushes handlers when the page unloads to avoid memory leaks
		if(!winInfo.flushHandlerRegistered){
			winInfo.flushHandlerRegistered = true;
			addEventHandler(ownerWindow, "unload", flushAllHandlers);
		}
		
		if(type === "DOMContentLoaded"){
			//make sure DOMContentLoaded handlers are executed even if the event is not supported
			addTypeHandler(ownerWindow.document, "DOMContentLoaded");
			addTypeHandler(ownerWindow.document, "readystatechange");
			addTypeHandler(ownerWindow, "load");
			
			//make sure the object's window handles the events to allow for the maintenance of the event stack
			addTypeHandler(ownerWindow, "DOMContentLoaded");
			addTypeHandler(ownerWindow, "readystatechange");
			
			//add global handlers for the event type for the object (if they don't already exist)
			addTypeHandler(obj, "DOMContentLoaded");
		}
		else if(type === "mouseenter"){
			if(window.addEventListener){	//not IE lte 8
				//make sure the object's window handles the mouseover type so that the mouseenter event can be triggered afterwards
				addTypeHandler(ownerWindow, "mouseover");
			}
			else{	//IE lte 8
				//make sure the object's document handles the mouseover type so that the mouseenter event can be triggered afterwards
				addTypeHandler(ownerWindow.document, "mouseover");
			}
			
			//add global handlers for the mouseover event type for the object (if they don't already exist)
			addTypeHandler(obj, "mouseover");
			if(!obj._eventHandlers["mouseenter"]) obj._eventHandlers["mouseenter"] = { capture: [], bubble: [] };
		}
		else if(type === "mouseleave"){
			if(window.addEventListener){	//not IE lte 8
				//make sure the object's window handles the mouseout type so that the mouseleave event can be triggered afterwards
				addTypeHandler(ownerWindow, "mouseout");
			}
			else{	//IE lte 8
				//make sure the object's document handles the mouseout type so that the mouseleave event can be triggered afterwards
				addTypeHandler(ownerWindow.document, "mouseout");
			}
			
			//add global handlers for the mouseout event type for the object (if they don't already exist)
			addTypeHandler(obj, "mouseout");
			if(!obj._eventHandlers["mouseleave"]) obj._eventHandlers["mouseleave"] = { capture: [], bubble: [] };
		}
		else{
			//make sure the object's window handles the event to allow for the maintenance of the event stack
			addTypeHandler(ownerWindow, type);
			
			//add global handlers for the event type for the object (if they don't already exist)
			addTypeHandler(obj, type);
		}
		
		if(isNaN(handler._handlerGUID) || handler._handlerGUID < 1 || handler._handlerGUID === Infinity){
			handler._handlerGUID = newGUID++;	//assign a GUID to the handler if it doesn't have one (or if it was messed with)
		}
		
		phase = useCapture ? "capture" : "bubble";
		if(!handlerIsAssigned(obj, type, phase, handler._handlerGUID)){	//if this handler isn't already assigned to this object, event type, and phase
			obj._eventHandlers[type][phase].push({ guid: handler._handlerGUID, handler: handler });	//add the handler to the list
		}
		
		return handler._handlerGUID;
		
	};
	
	//get the window in which the object resides; this is not necessarily the same window where a function is defined
	//see http://outofhanwell.wordpress.com/2006/07/03/cross-window-events/
	function getOwnerWindow(obj){
		var doc, win;
		try{
			doc = obj.ownerDocument || obj.document || obj;
			/*	  obj==element         obj==window     obj==document */
			win = doc.defaultView || doc.parentWindow;
		}catch(e){	//obj is not an object
			return null;
		}
		try{
			if(Object.prototype.toString.call(win) === Object.prototype.toString.call(window)){
				return win;
			}
			else{
				return null;
			}
		}catch(e){	//IE lte 7
			return win;
		}
	}
	
	//add global handlers for an event type for an object (if they don't already exist)
	function addTypeHandler(obj, type){
		if(!obj._eventHandlers) obj._eventHandlers = {};
		if(!obj._eventHandlers[type]){
			obj._eventHandlers[type] = { capture: [], bubble: [] };
			
			if(window.addEventListener){	//not IE lte 8
				obj.addEventListener(type, patchHandler(obj, true), true);
				obj.addEventListener(type, patchHandler(obj, false), false);
			}
			else if(obj.attachEvent){	//IE lte 8; capture phase is not natively supported
				obj.attachEvent("on"+type, patchHandler(obj));
			}
			else{	//just in case; capture phase is not natively supported
				if(obj["on"+type]){	//if there is already a handler assigned
					obj["on"+type]._handlerGUID = newGUID;
					obj._eventHandlers[type]["bubble"][0] = { guid: newGUID++, handler: obj["on"+type] };
				}
				obj["on"+type] = patchHandler(obj);
			}
		}
	}
	
	function patchHandler(obj, capturing){
		
		return function (evt){
			var evtWindow;
			
			//In IE lte 8, in case this type handler is assigned to an event attribute on a DOM node instead of using attachEvent(), 
			// we need to get the event object from the window the node resides in (which is not necessarily where the handler was defined).
			evtWindow = getOwnerWindow(obj);
			evt = evt || evtWindow.event;
			if(!evt.view) evt.view = evtWindow;
			
			handleEvent.call(obj, evt, capturing);	//applies the correct value for the `this` keyword and passes the event object
		};
		
	}
	
	//is the handler for this object, event type, and phase already in the list?
	function handlerIsAssigned(obj, type, phase, guid){
		var handlerList, i;
		
		if(!obj._eventHandlers || !obj._eventHandlers[type] || !guid) return false;
		handlerList = obj._eventHandlers[type][phase];
		for(i=0; i<handlerList.length; i++){
			if(handlerList[i].guid === guid)
				return true;	//handler is already in the list
		}
		return false;
	}
	
	
	
	/*** event handling ***/
	
	function handleEvent(evt, capturing, customEvent){
		
		var winInfo, evtInfo, returnValue, path, handlers, i;
		var runCapturePhase, propagationPath = [], captureEvt;
		
		winInfo = windowInfo(evt.view);
		
		
		
		/***** initialize event object *****/
		
		try{ evt.currentTarget = this; }catch(e){}	//for custom events and just in case
		
		//for not IE lte 8, update the event stack if this is the first handler executed for this event (i.e., if at beginning of capture phase)
		if(window.addEventListener && (winInfo.eventStack.length === 0 || evt !== winInfo.eventStack[0].event)){
			
			patchEvent(evt);
			
			//add this event to the event stack
			winInfo.eventStack.unshift({ event:evt, propagationStopped:false, propagationStoppedAtTarget:false, propagationStoppedImmediately:false });
			
			
		}
		//for IE lte 8, update event status via the event stack
		else if(!window.addEventListener){
			
			patchEvent(evt);
			
			//use a copy of the event object (so we can modify read-only properties)
			evt = createEventClone(evt);
			evt.eventPhase = evt.target===this ? 2 : capturing ? 1 : 3;
			
			//add an event status object to the event stack if this is the first handler executed for this event
			if(!winInfo.eventStack[winInfo.handlerDepth]){
				winInfo.eventStack.push({});
				runCapturePhase = true;
			}
			
		}
		
		if(window.addEventListener){	//not IE lte 8
			evtInfo = winInfo.eventStack[0];
		}
		else{	//IE lte 8
			evtInfo = winInfo.eventStack[winInfo.handlerDepth];
			
		}
		
		
		
		/***** trigger DOMContentLoaded event, if required *****/
		
		if(!winInfo.DOMContentLoaded){
			if(evt.type === "DOMContentLoaded"){
				winInfo.DOMContentLoaded = true;
			}
			else if(evt.type === "readystatechange" && evt.view.document.readyState === "complete"){
				//note: IE sets readyState to "interactive" once it encounters a script in the body--it does not wait for the entire page to be parsed--so
				// it would be unreliable as a replacement for DOMContentLoaded. It is set to "complete" just before the load event is fired.
				winInfo.DOMContentLoaded = true;
				triggerCustomEvent(evt, "DOMContentLoaded", true, evt.view.document);
			}
			else if(evt.type === "load" && evt.target === evt.view){
				winInfo.DOMContentLoaded = true;
				triggerCustomEvent(evt, "DOMContentLoaded", true, evt.view.document);
			}
		}
		
		
		
		/***** prepare for mouseenter/mouseleave event, if required *****/
		
		//at the first handler for a mouseover/mouseout event
		if((evt.type === "mouseover" || evt.type === "mouseout") && !evtInfo.mouseELQueue){
			//get list of elements the mouseenter/mouseleave event will need to be fired on
			evtInfo.mouseELQueue = getMouseELQueue(evt);
		}
		
		
		
		/***** initialize return value *****/
		
		returnValue = evt.type==="beforeunload" ? returnValue : evt.type==="mouseover" ? false : true;
		
		//updates the return value so that, if the default action has already been cancelled, it will remain cancelled
		function updateReturnValue(newValue){
			if(evt.type === "beforeunload"){
				//in this implementation, only the first non-empty return value will be used; return values from subsequent handlers will be ignored
				returnValue = typeof(returnValue) !== "undefined" && returnValue !== "" ? returnValue : newValue;
			}
			else if(evt.type === "mouseover"){
				//returnValue will be false unless the default action has been cancelled
				returnValue = returnValue === true || newValue === true || evt.returnValue === true || evt.defaultPrevented;
			}
			else{
				//if the event is not cancelable, returnValue will always be true
				//otherwise, it will be true unless the default action has been cancelled
				returnValue = !evt.cancelable || (returnValue && newValue !== false && evt.returnValue !== false && !evt.defaultPrevented);
			}
		}
		
		
		
		/***** for IE lte 8, execute capture phase if necessary *****/
		
		if(runCapturePhase && !customEvent){
			
			//get propagation path (first item is the window, last item is the target)
			propagationPath = getPropagationPath(evt);
			
			captureEvt = createEventClone(evt);
			captureEvt.eventPhase = 1;
			
			//execute the capture handlers of each object in the propagation path (top-down)
			while(propagationPath.length){
				handleEvent.call(propagationPath.shift(), captureEvt, true);
			}
			
		}
		
		
		
		/***** execute handlers for currentTarget *****/
		
		//execute the handlers for this phase (in FIFO order)
		if(!evtInfo.propagationStopped || (evt.eventPhase === 2 && evtInfo.propagationStoppedAtTarget && !evtInfo.propagationStoppedImmediately)){
			
			if(!window.addEventListener){	//IE lte 8
				winInfo.handlerDepth++;
			}
			
			if(this._eventHandlers && this._eventHandlers[evt.type]){
				
				handlers = this._eventHandlers[evt.type][capturing ? "capture" : "bubble"];
				for(i=0; i<handlers.length; i++){
					//execute the handler and update the return value
					updateReturnValue(handlers[i].handler.call(this, evt));
					
					if(evtInfo.propagationStoppedImmediately) break;
				}
				
			}
			
			if(!window.addEventListener){	//IE lte 8
				if(winInfo.eventStack[winInfo.handlerDepth]){	//if there was a nested event
					winInfo.eventStack.pop();	//remove the nested event's status from the eventStack
				}
				winInfo.handlerDepth--;
			}
			
		}
		
		
		
		/***** trigger mouseenter/mouseleave event, if required *****/
		
		if(!capturing && (this === evt.view || (!window.addEventListener && this === evt.view.document))){
			
			//trigger mouseenter events, if applicable
			if(evt.type === "mouseover"){
				while(evtInfo.mouseELQueue.length > 0){
					triggerCustomEvent(evt, "mouseenter", false, evtInfo.mouseELQueue.pop());
				}
			}
			//trigger mouseleave events, if applicable
			else if(evt.type === "mouseout"){
				while(evtInfo.mouseELQueue.length > 0){
					triggerCustomEvent(evt, "mouseleave", false, evtInfo.mouseELQueue.shift());
				}
			}
			
		}
		
		
		
		/***** update/finalize event *****/
		
		//if returnValue indicates default action should be cancelled, be sure that it has been
		if(evt.type !== "beforeunload" && ((evt.type === "mouseover" && returnValue) || (evt.type !== "mouseover" && !returnValue))){
			evt.preventDefault();
		}
		
		//update evt.returnValue
		evt.returnValue = evt.type === "beforeunload" ? (typeof(returnValue) === "undefined" || returnValue === "") : returnValue;
		
		//for all but IE lte 8, if done handling this event, remove it from the event stack
		if(window.addEventListener && !capturing && (this === evt.view || evt.bubbles === false)){
			winInfo.eventStack.shift();
		}
		//for IE lte 8, if done handling this event, reset the event status
		//note: evt.bubbles is undefined in IE lte 8, but this is fine since the only two events we care about (mouseover and mouseout) bubble to the document
		else if(!window.addEventListener && !capturing && this === evt.view.document && !winInfo.handlerDepth){	//IE lte 8, not in a nested event
			winInfo.eventStack.pop();
		}
		
		
		
		return returnValue;
		
	}
	
	//get hierarchical array of objects for mouseenter & mouseleave events; first item is the target
	function getMouseELQueue(evt){
		
		//note: this can get screwed up if elements are moved/removed from the DOM
		
		var obj, obj2, mouseELQueue = [];
		
		if(evt.target === evt.relatedTarget){
			//do nothing
		}
		else if(evt.target === evt.view){
			//related is a child of window; did not enter or leave window; do nothing
		}
		else if(evt.relatedTarget === null){
			//entered/left window; events will be fired
			obj = evt.target;
			while(obj){
				mouseELQueue.push(obj);
				obj = obj.parentNode;
			}
			mouseELQueue.push(evt.view);
		}
		else{
			obj = evt.relatedTarget;
			while(obj && obj !== evt.target){
				obj = obj.parentNode
			}
			if(obj === evt.target){
				//related is a child of target; did not enter or leave target; do nothing
			}
			else{
				//related is not a child of target (but target is not necessarily a child of related);
				// entered/left target; possibly left/entered related; events will be fired
				obj = evt.target;
				while(obj && obj !== evt.relatedTarget){
					obj2 = evt.relatedTarget;
					while(obj2 && obj2 !== obj){
						obj2 = obj2.parentNode;
					}
					if(obj === obj2){	//common ancestor of target & related (mouse left/entered related)
						break;
					}
					mouseELQueue.push(obj);	//obj is a child of related
					obj = obj.parentNode;
				}
			}
		}
		
		return mouseELQueue;
		
	}
	
	//get array of objects ancestral to the event target; first item is the window, last item is the target
	function getPropagationPath(evt){
		
		var path = [];
		
		path[0] = evt.target;
		while(path[0].parentNode){
			path.unshift(path[0].parentNode);
		}
		if(path[0] === evt.view.document){
			path.unshift(evt.view);
		}
		
		return path;
		
	}
	
	//initializes event attributes to work cross-browser
	//should only be called once per event, at the beginning of the event handling
	function patchEvent(evt){
		
		var originalPreventDefault, originalGetModifierState, mb, charCode;
		
		if(!evt.target) evt.target = evt.srcElement;
		if(!evt.srcElement) try{ evt.srcElement = evt.target; }catch(e){}	//IE lte 8 throws an error if evt.target is null (e.g., on a readystatechange event)
		if(typeof(evt.relatedTarget) === "undefined") try{ evt.relatedTarget = evt.target===evt.toElement ? evt.fromElement : evt.toElement; }catch(e){}
		
		if(typeof(evt.cancelable) === "undefined") evt.cancelable = true;	//if unknown (IE lte 8), treat event as if it's cancelable
		originalPreventDefault = evt.preventDefault;
		evt.preventDefault = function preventDefault(){
			if(this.cancelable){
				if(originalPreventDefault) originalPreventDefault.call(this);
				try{ this.defaultPrevented = true; }catch(e){}
				this.returnValue = evt.type==="mouseover" ? true : false;
			}
		};
		evt.stopPropagation = patchEvent.stopPropagation;
		evt.stopImmediatePropagation = patchEvent.stopImmediatePropagation;
		
		
		/*** mouse & keyboard event attributes ***/
		
		originalGetModifierState = evt.getModifierState;
		if(originalGetModifierState){
			evt.getModifierState = function getModifierState(key){
				if(key === "Scroll" || key === "ScrollLock"){
					return originalGetModifierState.call(this, "Scroll") || originalGetModifierState.call(this, "ScrollLock");
				}
				else if(key === "OS" || key === "Win"){
					return originalGetModifierState.call(this, "OS") || originalGetModifierState.call(this, "Win");
				}
				else{
					return originalGetModifierState.call(this, key);
				}
			};
			if(typeof(evt.metaKey) === "undefined") evt.metaKey = originalGetModifierState.call(this, "Meta");
		}
		
		
		/*** mouse event attributes ***/
		
		if(!evt.fromElement && !evt.toElement){
			try{
				if(evt.type === "mouseover" || evt.type === "mouseenter"){
					evt.fromElement = evt.relatedTarget;
					evt.toElement = evt.target;
				}
				else if(evt.type === "mouseout" || evt.type === "mouseleave"){
					evt.fromElement = evt.target;
					evt.toElement = evt.relatedTarget;
				}
			}catch(e){}
		}
		
		//add custom mouse attributes
		evt.mouse = {};
		
		//mouse button
		//this is the button that was pressed to trigger this event: 1==left, 2==right, 4==middle
		if(evt.type === "mousedown" || evt.type === "mouseup" || evt.type === "click" || evt.type === "dblclick"){
			if(evt.which){
				evt.mouse.button = evt.which===1 ? 1 : evt.which===2 ? 4 : 2;
			}
			else{	//IE lte 8
				mb = patchEvent.mouseButtons;
				
				//note: only update patchEvent.mouseButtons at beginning of event handling
				if(evt.type === "mousedown"){
					mb.button = (evt.button ^ mb.pressed) & evt.button;
					if((mb.button & evt.button) === 0) mb.button = evt.button;
					mb.pressed = evt.button;
					
					//note: mb.button may be incorrect on mousedown since we can't reliably keep track of IE's event.button
					// value (i.e., which buttons are pressed when the event is fired) between events (e.g., if the mouse
					// leaves the window, buttons are changed by the user without the browser's detection, and the mouse comes back)
				}
				else if(evt.type === "mouseup"){
					mb.button = evt.button;
					mb.pressed = ~evt.button & mb.pressed;
				}
				
				evt.mouse.button = mb.button;
			}
		}
		else{
			evt.mouse.button = patchEvent.mouseButtons.button = 0;
		}
		
		//mouse position
		if(evt.type.slice(0,5) === "mouse" || evt.type==="wheel" || evt.type==="DOMMouseScroll" || evt.type.slice(0,4)==="drag" || evt.type==="drop"){
			evt.mouse.position = {};
			evt.mouse.position.screen = { x:evt.screenX, y:evt.screenY, left:evt.screenX, top:evt.screenY };
			evt.mouse.position.window = evt.mouse.position.frame = { x:evt.clientX, y:evt.clientY, left:evt.clientX, top:evt.clientY };
			evt.mouse.position.document = (function (){
				var de = document.documentElement;
				var b = document.body;
				var left, top;	//scroll position of document
				if(isNaN(evt.pageX) || isNaN(evt.pageY)){
					if(window.pageYOffset)	//all except IE
					{ left = window.pageXOffset; top = window.pageYOffset; }
					else if(de && !isNaN(de.scrollTop))	//IE standards compliance mode
					{ left = de.scrollLeft-de.clientLeft; top = de.scrollTop-de.clientTop; }
					else	//IE quirks mode
					{ left = b.scrollLeft-b.clientLeft; top = b.scrollTop-b.clientTop; }
					return { x:left+evt.clientX, y:top+evt.clientY, left:left+evt.clientX, top:top+evt.clientY };
				}
				else return { x:evt.pageX, y:evt.pageY, left:evt.pageX, top:evt.pageY };
			})();
			evt.mouse.position.layer = { x:evt.layerX||evt.x||0, y:evt.layerY||evt.y||0, left:evt.layerX||evt.x||0, top:evt.layerY||evt.y||0 };
			
			try{
				evt.pageX = evt.mouse.position.document.x;
				evt.pageY = evt.mouse.position.document.y;
			}catch(e){}
			try{
				evt.layerX = evt.mouse.position.layer.x;
				evt.layerY = evt.mouse.position.layer.y;
			}catch(e){}
		}
		
		
		/*** keyboard event attributes ***/
		
		//add custom keyboard attributes
		evt.keyboard = {};
		
		//see http://unixpapa.com/js/key.html
		//    http://www.quirksmode.org/js/keys.html
		//    http://www.w3.org/TR/DOM-Level-3-Events/#events-keyboardevents
		//    https://www.w3.org/Bugs/Public/show_bug.cgi?id=18461
		
		function getCharGuess(keyCode){
			switch(keyCode){
				case 32:	return " ";
				case 13:	return "\n";
				case 9:		return "\t";
				case 27:	return "\u001B";	//Esc
				case 8:		return "\b";
			}
			return "";
		}
		function getKey(key, char){
			if(key){
				switch(key){
					case "Scroll":	return "ScrollLock";
				}
				return key;
			}
			if(char){
				switch(char){
					case " ":				return "Spacebar";
					case "\n": case "\r":	return "Enter";	//Chrome gives \r for event.char
					case "\t":				return "Tab";
					case "\u001B":			return "Esc";
					case "\b":				return "Backspace";
				}
				return char;
			}
			return "Unidentified";
		}
		function getKeyGuess(keyCode){
			if(keyCode){
				//key values for key codes that are consistent across browsers (at least on an English QWERTY keyboard)
				if(keyCode >= 112 && keyCode <= 123){	//F1-F12
					return "F"+(keyCode-111);
				}
				switch(keyCode){
					case 32:	return "Spacebar";
					case 13:	return "Enter";
					case 9:		return "Tab";
					case 27:	return "Esc";
					case 8:		return "Backspace";
					
					case 16:	return "Shift";
					case 17:	return "Control";
					case 18:	return "Alt";
					case 20:	return "CapsLock";
					case 144:	return "NumLock";
					case 145:	return "ScrollLock";
					case 37:	return "Left";
					case 38:	return "Up";
					case 39:	return "Right";
					case 40:	return "Down";
					case 45:	return "Insert";
					case 46:	return "Del";
					case 36:	return "Home";
					case 35:	return "End";
					case 33:	return "PageUp";
					case 34:	return "PageDown";
				}
			}
			return "Unidentified";
		}
		
		if(evt.type === "keypress"){
			if((!evt.char && evt.char !== "") && isNaN(evt.which)){	//IE lte 8
				evt.keyboard.char = String.fromCharCode(evt.keyCode);
				evt.keyboard.charGuess = evt.keyboard.char;
				evt.keyboard.key = getKey(evt.key, evt.keyboard.char);
				evt.keyboard.keyGuess = evt.keyboard.key;
			}
			else{
				//note: in Opera, some special keys (notably: home, end, insert, delete, num lock, scroll lock) still give non-zero values for evt.which,
				// so these may be incorrect
				charCode = evt.which && evt.charCode!==0 ? evt.which : 0;
				evt.keyboard.char = evt.char || ( charCode ? String.fromCharCode(charCode) : "" );
				evt.keyboard.charGuess = evt.keyboard.char || getCharGuess(evt.keyCode);
				evt.keyboard.key = getKey(evt.key, evt.keyboard.char);
				evt.keyboard.keyGuess = evt.keyboard.key || getKeyGuess(charCode ? 0 : evt.keyCode);
			}
		}
		else if(evt.type === "keydown" || evt.type === "keyup"){
			evt.keyboard.char = evt.char;
			evt.keyboard.charGuess = evt.keyboard.char || getCharGuess(evt.keyCode);
			evt.keyboard.key = getKey(evt.key, evt.keyboard.char);
			evt.keyboard.keyGuess = evt.keyboard.key || getKeyGuess(evt.keyCode);
		}
		
	}
	patchEvent.stopPropagation = function stopPropagation(){
		var winInfo, evtInfo;
		winInfo = windowInfo(this.view);
		evtInfo = winInfo.eventStack[window.addEventListener ? 0 : winInfo.handlerDepth];
		if(this.eventPhase === 2 && !evtInfo.propagationStopped) evtInfo.propagationStoppedAtTarget = true;
		evtInfo.propagationStopped = true;
	};
	patchEvent.stopImmediatePropagation = function stopImmediatePropagation(){
		var winInfo, evtInfo;
		winInfo = windowInfo(this.view);
		evtInfo = winInfo.eventStack[window.addEventListener ? 0 : winInfo.handlerDepth];
		if(this.eventPhase === 2 && !evtInfo.propagationStopped) evtInfo.propagationStoppedAtTarget = true;
		evtInfo.propagationStopped = true;
		evtInfo.propagationStoppedImmediately = true;
	};
	patchEvent.mouseButtons = { button:0, pressed:0 };	//for IE lte 8; keeps track of which mouse buttons are pressed (not always accurate)
	
	function triggerCustomEvent(evt, type, bubbles, target){
		
		var path, i;
		
		//create cloned event object
		evt = createEventClone(evt);
		evt.type = type;
		evt.bubbles = bubbles;
		evt.target = target;
		evt.cancelable = false;
		evt.returnValue = true;
		evt.defaultPrevented = false;
		
		path = getPropagationPath(evt);	//array of objects ancestral to the event target; first item is the window, last item is the target
		
		
		/*** run capture phase ***/
		
		evt.eventPhase = 1;
		
		for(i=0; i<=path.length-2; i++){	//for each object (top-down) in the propagation path, not including the target
			//execute the capture handlers on the object
			handleEvent.call(path[i], evt, true, true);
		}
		
		
		/*** run target phase ***/
		
		evt.eventPhase = 2;
		
		//execute capture handlers on target object
		handleEvent.call(target, evt, true);
		
		//execute bubble handlers on target object
		handleEvent.call(target, evt, false, true);
		
		
		/*** run bubble phase ***/
		
		if(evt.bubbles){
			
			evt.eventPhase = 3;
			
			for(i=path.length-2; i>=0; i--){	//for each object (bottom-up) in the propagation path, not including the target
				//execute the bubble handlers on the object
				handleEvent.call(path[i], evt, false, true);
			}
			
		}
		
	}
	
	//creates a custom object to use as an event object; this allows modification of properties that are read-only on the original object
	function createEventClone(eventToClone){
		var evt = {}, i;
		for(i in eventToClone) evt[i] = eventToClone[i];
		
		return evt;
	}
	
	
	
	/*** avoid memory leaks ***/
	
	//removes circular references and avoids memory leaks when the window unloads (especially for IE)
	function flushAllHandlers(evt){
		
		var elems, i;
		
		//nulls event attributes and handler collection
		function flushHandlers(obj){
			var prop;
			obj._eventHandlers = null;
			for(prop in obj){
				if(prop.slice(0, 2) === "on") obj[prop] = null;
			}
		}
		
		elems = evt.view.document.getElementsByTagName("*");
		for(i=0; i<elems.length; i++){
			flushHandlers(elems[i]);
		}
		flushHandlers(evt.view.document);
		flushHandlers(evt.view);
		
	}
	
	
	
	/*** event handler removal ***/
	
	function removeEventHandler(obj, type, handler_or_guid, useCapture){
		
		var quid, handlers, i;
		
		ownerWindow = getOwnerWindow(obj);
		
		if(!ownerWindow){
			//Unable to determine the window in which obj resides; most likely, obj is not a DOM element
			throw new TypeError("Invalid argument for removeEventHandler(): obj");
		}
		if(!(/^[a-z][0-9a-z]*$/i).test(type)){
			throw new TypeError("Invalid argument for removeEventHandler(): type");
		}
		if(( isNaN(handler_or_guid) && typeof(handler_or_guid) !== "function" ) || handler_or_guid < 1 || handler_or_guid === Infinity){
			throw new TypeError("Invalid argument for removeEventHandler(): handler_or_guid");
		}
		
		guid = typeof(handler_or_guid)==="function" ? handler_or_guid._handlerGUID : handler_or_guid;
		if(isNaN(guid) || guid < 1 || guid === Infinity){	//in case ._handlerGUID was messed with
			throw new TypeError("Invalid argument for removeEventHandler(): handler_or_guid");
		}
		
		//remove any handlers that have this GUID (should only be one unless ._handlerGUID was messed with)
		if(obj._eventHandlers && obj._eventHandlers[type]){
			handlers = obj._eventHandlers[type][useCapture ? "capture" : "bubble"];
			for(i=0; i<handlers.length; i++){
				if(handlers[i].guid === guid){	//handler is in the list
					handlers.splice(i, 1);	//remove the handler from the list
				}
			}
		}
		
	};
	
})();
