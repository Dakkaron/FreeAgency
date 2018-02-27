var sceneData = 'Das ist ein\n\
Beispieltext\n\
*create testvar "TEST"\n\
*set testvar "Hallo"\n\
*choice\n\
	#Wahl 1\n\
		${testvar}, du \n\
		hast Wahl 1 ausgewählt\n\
		*finish\n\
		Das hier sollte nicht angezeigt werden\n\
	#Wahl 2\n\
		${testvar}, du hast Wahl 2 ausgewählt\n\
		*finish\n';

function tokenize(scene) {
	var tokenList = [];
	var indentation = "";
	
	function _checkIndent(indent) {
		if (indent.length==0) {
			return 0;
		}
		if (indent.match(" ") && indent.match("\t")) {
			throw "Syntax Error: Indentation containing both spaces and tabs.";
		}
		if (indentation=="") {
			indentation = indent;
			return 1;
		}
		if (!(indent.match(indentation))) {
			if (indentation[0]==" ") {
				throw "Syntax Error: Indentation contains tabs but spaces were used before.";
			} else {
				throw "Syntax Error: Indentation contains spaces but tabs were used before.";
			}
		}
		var count = indent.length / indentation.length;
		if (count != Math.floor(count)) {
			throw "Syntax Error: Indentation not a multiple of indentation step length. Needs to be a multiple of "+indentation.length+".";
		}
		return count;
	}

	var lines = scene.split("\n");
	lines.forEach((element, index, array) => {
		try {
			var matchCommand = element.match("([\t ]*)[*]([^ ]*)(?: (.*))?");
			var matchChoiceTarget = element.match("([\t ]*)[#](.*)");
			if (matchCommand) { // Command
				tokenList.push({
						"type":"COMMAND",
						"command":matchCommand[2],
						"params":matchCommand[3],
						"indent":_checkIndent(matchCommand[1]),
						"linenr":index+1
					});
			} else if (matchChoiceTarget) { // Choice target
				tokenList.push({
						"type":"CHOICETARGET","target":matchChoiceTarget[2],
						"indent":_checkIndent(matchChoiceTarget[1]),
						"choice":matchChoiceTarget[3],
						"linenr":index+1
					});
			} else if (element.trim().length == 0) {
				// ignore empty lines
			} else { // Plain text
				tokenList.push({
						"type":"PLAINTEXT",
						"text": element.trimLeft(),
						"indent":_checkIndent(element.match("([\t ]*)")[1]),
						"linenr":index+1
					});
			}
		} catch(err) {
			throw "Line "+(index+1)+": "+err;
		}
	});
	
	return tokenList;
}

function prettyPrintTokens(tokenList) {
	var prettyTokens = [];
	tokenList.forEach((element, index, array) => {
		prettyTokens.push(JSON.stringify(element, null, 4));
	});
	return prettyTokens;
}

function parseTokens(tokenList) {
	var parsedTree = {"parent":null, "items":[]};
	var currentParseLevel = parsedTree;
	var currentIndent = 0;
	var i=0;
	var choiceId=0;

	function addParseLevel(cause) {
		var newParseLevel = {
				"parent": currentParseLevel,
				"items": []
			};
		for (var x in cause) {
			newParseLevel[x] = cause[x];
		};
		currentParseLevel.items.push(newParseLevel);
		currentParseLevel = newParseLevel;
		currentIndent += 1;
	}

	tokenList.forEach((element, index, array) => {
		if (element.indent > currentIndent) {
			throw "Line "+element.linenr+": Syntax Error: wrong indentation level!"
		} else if (element.indent < currentIndent) {
			for (i=currentIndent; i>element.indent; i--) {
				currentParseLevel = currentParseLevel.parent;
			}
			currentIndent = element.indent;
		}
		if (element.type == "PLAINTEXT") {
			currentParseLevel.items.push(element);
		} else if (element.type == "COMMAND") {
			if (element.command == "choice") {
				element.choiceCount = 0;
				addParseLevel(element);
			} else {
				currentParseLevel.items.push(element);
			}
		} else if (element.type == "CHOICETARGET") {
			element.choiceId = currentParseLevel.choiceCount;
			currentParseLevel.choiceCount += 1;
			addParseLevel(element);
		}
	});
	
	return parsedTree;
}

function printableParsedTree(node) {
	if ((typeof node["parent"])==="undefined") {
		return node;
	}
	var pnode = {
			"items": []
		};
	for (var x in node) {
			if (x !== "parent" && x !== "items") {
				pnode[x] = node[x];
			}
		};
	node.items.forEach((element, index, array) => {
			pnode.items.push(printableParsedTree(element));
		});
	return pnode;
}

var choiceSelected = null;
var renderStack = null;
var renderedHtml = null;
var globals = {};
function choiceNextButtonPressed() {
	choiceSelected = $('input[name=choiceRadio]:checked', '#choiceform').val();
	[renderStack, renderedHtml] = render(renderStack)
	$("#renderedOutputDiv").html(renderedHtml);
}

function finishButtonPressed() {
	//Todo: next chapter
}

function renderCommandChoice(node, renderStack, html) {
	var newHtml = "";
	if (choiceSelected == null) { // render options
		var first = true;
		node.items.forEach((element, index, array) => {
			if (element.type == "CHOICETARGET") {
				newHtml += '<div class="radio"><label><input type="radio" name="choiceRadio" value="'+element.choiceId+'"' + (first ? "checked":"") + '>'+element.target+"</label></div>\n";
				first = false;
			}
			// Todo: handle ifs
		});
		html += '<form id="choiceform">\n'+newHtml+'</form><button onclick="choiceNextButtonPressed()" name="nextbutton" type="button" class="btn btn-primary">Next</button>\n';
		choiceSelected = null;
		return [false, renderStack, html];
	} else { // render content of chosen option
		var selectedChoice = null;
		node.items.forEach((element, index, array) => {
			if (selectedChoice==null && element.type == "CHOICETARGET") {
				if (choiceSelected == element.choiceId) {
					selectedChoice = element;
				}
			}
			// Todo: handle ifs
		});
		if (selectedChoice !== null) {
			renderStack = {"node":selectedChoice, "pointer":0, "parent":renderStack};
			[renderStack, html] = render(renderStack);
			return [false, renderStack, html];
		} else {
			throw "Line "+element.linenr+": No choice option selected!";
		}
	}
	[keepRendering, renderStack] = incrementRenderStack(renderStack); // Todo: remove this dummy fall-through
	return [keepRendering, renderStack, html]; // Todo: remove this dummy fall-through
}

function incrementRenderStack(renderStack) {
	/*
	Increases renderStack.pointer.
	Returns [keepRendering, renderStack].
	If rendering of renderStack.node is finished, return
	renderStack.parent as renderStack. If renderStack.parent==null,
	return false as keepRendering (true otherwise) and renderStack as renderStack.
	*/
	renderStack.pointer += 1;
	if (renderStack.pointer >= renderStack.node.items.length) {
		if (renderStack.parent == null) {
			return [false, renderStack];
		} else {
			return incrementRenderStack(renderStack.parent);
		}
	}
	return [true, renderStack];
}

function renderDelegator(renderStack, html) {
	var node = null;
	if (renderStack.pointer === -1) {
		node = renderStack.node;
	} else {
		node = renderStack.node.items[renderStack.pointer];
	}
	if (node.type == "COMMAND") {
		if (node.command == "choice") {
			return renderCommandChoice(node, renderStack, html);
		} else if (node.command == "finish") {
			html += '<br><div><button onclick="finishButtonPressed()" name="finishbutton" type="button" class="btn btn-primary">Next Chapter</button></div>\n';
			return [false, renderStack, html];
		} else if (node.command == "create") {
			var cmdMatch = node.params.match("([^ \t]+) +(.+)");
			if (!cmdMatch) {
				throw "Line "+node.linenr+": Syntax Error: *create needs to have a variable name and a value!"
			}
			var varname = cmdMatch[1];
			var value = cmdMatch[2];
			if (varname in globals) {
				throw "Line "+node.linenr+": Runtime Error: variable with name "+varname+" already created!"
			} else {
				globals[varname] = value;
				console.log("Created variable "+varname+" with value "+value);
			}
		} else if (node.command == "set") {
			var cmdMatch = node.params.match("([^ \t]+) +(.+)");
			if (!cmdMatch) {
				throw "Line "+node.linenr+": Syntax Error: *set needs to have a variable name and a value!"
			}
			var varname = cmdMatch[1];
			var value = cmdMatch[2];
			if (!(varname in globals)) {
				throw "Line "+node.linenr+": Runtime Error: no variable with name "+varname+" exists! Create it first using *create"
			} else {
				globals[varname] = value;
			}
		}
		// Todo: other commands
	} else if (node.type == "CHOICETARGET") {
		// Todo: handle error, should never happen!
	} else if (node.type == "PLAINTEXT") {
		[keepRendering, renderStack] = incrementRenderStack(renderStack);
		var text = node.text;
		for (var v in globals) {
			text = text.replace("${"+v+"}", globals[v]);
		}
		return [keepRendering, renderStack, html + "\n" + text];
	}
	[keepRendering, renderStack] = incrementRenderStack(renderStack); // Todo: remove this dummy fall-through
	return [keepRendering, renderStack, html]; // Todo: remove this dummy fall-through
}

function render(renderStack) {
	var html = "";
	var keepRendering = true;
	while (keepRendering) {
		[keepRendering, renderStack, html] = renderDelegator(renderStack, html);
	}
	return [renderStack, html];
}

$("#sourceCodeDiv").html(sceneData.replace(/\n/g,"<br>\n").replace(/\t/g,"\xa0".repeat(8)));
var tokenList = tokenize(sceneData);
$("#tokenListDiv").html(prettyPrintTokens(tokenList).join("<br><br>"));
var parsedTree = parseTokens(tokenList);
renderStack = {"node":parsedTree,"pointer":0,"parent":null};
$("#parsedTreeDiv").html(JSON.stringify(printableParsedTree(parsedTree), null, 4));
[renderStack, renderedHtml] = render(renderStack)
$("#renderedOutputDiv").html(renderedHtml);