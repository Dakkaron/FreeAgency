var sceneData = 'Das ist ein\n\
Beispieltext\n\
*set testvar "Hallo"\n\
*choice\n\
	#Wahl 1\n\
		${testvar}, du hast Wahl 1 ausgewählt\n\
		*finish\n\
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
						"text": element,
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
	var parsedTree = {"parent":null, "cause":null, "items":[]};
	var currentParseLevel = parsedTree;
	var currentIndent = 0;
	var i=0;

	function addParseLevel(cause) {
		var newParseLevel = {
				"parent": currentParseLevel,
				"cause": cause,
				"items": []
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
				element.chosen = null;
				addParseLevel(element);
			} else {
				currentParseLevel.items.push(element);
			}
		} else if (element.type == "CHOICETARGET") {
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
			"cause": node.cause,
			"items": []
		};
	node.items.forEach((element, index, array) => {
			pnode.items.push(printableParsedTree(element));
		});
	return pnode;
}

var renderStack = {"node":parsedTree,"pointer":0,"parent":null};

function renderCommandChoice(node, renderStack, html) {
	if (node.chosen == null) { // render options
		
	} else { // render content of chosen option
	}
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
			return [true, renderStack.parent];
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
		if (node.type == "choice") {
			return renderCommandChoice(node, renderStack, html);
		}
		// Todo: other commands
	} else if (node.type == "CHOICETARGET") {
		// Todo: handle error, should never happen!
	} else if (node.type == "PLAINTEXT") {
		[keepRendering, renderStack] = incrementRenderStack(renderStack);
		return [keepRendering, renderStack, html + "\n" + node.text];
	}
	// Todo: handle unknown commands
}

function render(parsedTree, renderStack) {
	var html = "";
	var keepRendering = true;
	while (keepRendering) {
		[keepRendering, renderStack, html] = renderDelegator(renderStack, html);
	}
	return pnode;
}

var tokenList = tokenize(sceneData);
$("#tokenListDiv").html(prettyPrintTokens(tokenList).join("<br><br>"));
var parsedTree = parseTokens(tokenList);
$("#parsedTreeDiv").html(JSON.stringify(printableParsedTree(parsedTree), null, 4));