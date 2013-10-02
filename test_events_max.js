var entryCount = 0;

function log(evt, options, val){
	
	var log, row, td;
	
	options = options || {};
	
	log = document.getElementById("log").getElementsByTagName("tbody")[0];
	
	row = document.createElement("tr");
	if(options.color) row.style.color = options.color;
	if(options.backgroundColor) row.style.backgroundColor = options.backgroundColor;
	
	//entry number
	td = document.createElement("td");
	td.style.textAlign = "right";
	td.innerHTML = ++entryCount;
	row.appendChild(td);
	
	//event type
	td = document.createElement("td");
	td.innerHTML = evt.type;
	row.appendChild(td);
	
	//event phase
	td = document.createElement("td");
	td.innerHTML = (["capture","target","bubble"])[evt.eventPhase-1];
	row.appendChild(td);
	
	//current target
	td = document.createElement("td");
	td.innerHTML = elemName(evt.currentTarget);
	row.appendChild(td);
	
	//target
	td = document.createElement("td");
	td.innerHTML = elemName(evt.target);
	row.appendChild(td);
	
	//related target
	td = document.createElement("td");
	td.innerHTML = elemName(evt.relatedTarget);
	row.appendChild(td);
	
	//optional value
	td = document.createElement("td");
	if(typeof(val) !== "undefined") td.appendChild(document.createTextNode(val));
	row.appendChild(td);
	
	log.insertBefore(row, log.firstChild);
	
}

function elemName(elem){
	
	if(!elem) return "";
	switch(elem){
		case window:	return "window";
		case document:	return "document";
		default:		if(elem.nodeName) return elem.nodeName.toLowerCase() + (elem.id ? "#"+elem.id : "");
						return elem.toString();
	}
	
}
