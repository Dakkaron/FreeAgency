var sceneData = 'Das ist ein\n\
Beispieltext\n\
*create testvar "TEST"\n\
*set testvar 1 + 2 > 1 and false\n\
*choice\n\
	#Wahl 1\n\
		${testvar}, du \n\
		hast Wahl 1 ausgewählt\n\
		*finish\n\
		Das hier sollte nicht angezeigt werden\n\
	#Wahl 2\n\
		${testvar}, du hast Wahl 2 ausgewählt\n\
		*choice\n\
			#Innere Wahl 1\n\
				Innere Wahl 1 ausgewählt\n\
				*finish\n\
			#Innere Wahl 2\n\
				Innere Wahl 2 ausgewählt\n\
				*finish\n';

/*sceneData = '*choice\n\
  #Make pre-emptive war on the western lands.\n\
    If you can seize their territory, your kingdom will flourish.  But your army\'s\n\
    morale is low and the kingdom\'s armory is empty.  How will you win the war?\n\
    *choice\n\
      #Drive the peasants like slaves; if we work hard enough, we\'ll win.\n\
        Unfortunately, morale doesn\'t work like that.  Your army soon turns against you\n\
        and the kingdom falls to the western barbarians.\n\
        *finish\n\
      #Appoint charismatic knights and give them land, peasants, and resources.\n\
        Your majesty\'s people are eminently resourceful.  Your knights win the day,\n\
        but take care: they may soon demand a convention of parliament.\n\
        *finish\n\
      #Steal food and weapons from the enemy in the dead of night.\n\
        A cunning plan.  Soon your army is a match for the westerners; they choose\n\
        not to invade for now, but how long can your majesty postpone the inevitable?\n\
        *finish\n\
  #Beat swords to plowshares and trade food to the westerners for protection.\n\
    The westerners have you at the point of a sword.  They demand unfair terms\n\
    from you.\n\
    *choice\n\
      #Accept the terms for now.\n\
        Eventually, the barbarian westerners conquer you anyway, destroying their\n\
        bread basket, and the entire region starves.\n\
        *finish\n\
      #Threaten to salt our fields if they don\'t offer better terms.\n\
        They blink.  Your majesty gets a fair price for wheat.\n\
        *finish\n\
  #Abdicate the throne. I have clearly mismanaged this kingdom!\n\
    The kingdom descends into chaos, but you manage to escape with your own hide.\n\
    Perhaps in time you can return to restore order to this fair land.\n\
    *finish\n\
';*/

//Fairmath polyfills
Number.prototype.fairAdd = function(val) {val=Number(val);return this + (100-this)*(val/100);};
Number.prototype.fairSub = function(val) {val=Number(val);return this - this*(val/100);};
String.prototype.fairAdd = function(val) {
	nthis = Number(val);
	if (isNaN(nthis)) {
		throw "Runtime Error: "+nthis+" is no number!"
	}
	nval = Number(val);
	if (isNaN(nval)) {
		throw "Runtime Error: "+val+" is no number!"
	}
	return this + (100-this)*(nval/100);
};
String.prototype.fairSub = function(val) {
	nthis = Number(val);
	if (isNaN(nthis)) {
		throw "Runtime Error: "+nthis+" is no number!"
	}
	nval = Number(val);
	if (isNaN(nval)) {
		throw "Runtime Error: "+val+" is no number!"
	}
	return this - this*(nval/100);
};
Boolean.prototype.fairAdd = function(val) {val=Number(val);return this + (100-this)*(val/100);};
Boolean.prototype.fairSub = function(val) {val=Number(val);return this - this*(val/100);};

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
	if ((typeof node["parent"])==='undefined') {
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

function parseCalc(varname, calc) {
	function recursiveCalc(tokens, pos) {
		if (typeof pos==='undefined') {
			pos = 0;
		}
		tokens.shift();
		for (;pos<tokens.length;pos++) {
			if (tokens[i]==="(") {
			}
		}
	}
	var OPERATORS = ["+","-","*","/"];
	var operator = null;
	var isCalc = false;
	var i;
	OPERATORS.forEach((operator, i, array) => {
		if (!isCalc && calc.indexOf(operator)>-1) {
			isCalc = true;
		}
	});
	if (isCalc) {
		calc = calc.trim();
		if (varname != null) {
			OPERATORS.forEach((operator, i, array) => {
				if (calc.startsWith(operator)) {
					calc = varname + operator + "(" + calc.substr(1) + ")";
				}
			});
		}
		var tokens = ("("+calc+")").split(/([-+*\/()]|(?:%[-+])|and|or|(?:[<>]=?)|!?=)/);
		for (var v in globals) {
			if (tokens.indexOf(v)>-1) {
				if (typeof(globals[v])!=='number') {
					throw "Syntax Error: variable "+v+" is not a number!";
				} else {
					for (i=0;i<tokens.length;i++) {
						if (tokens[i]===v) {
							tokens[i] = globals[v];
						}
					}
				}
			}
		}
		//var result = recursiveCalc(tokens); // Todo: own math implementation
		var ALLOWED_TOKENS = ["+","-","*","/","(",")","%+","%-","and","or","<","<=",">",">=","=","!="];
		var fairmathedTokens = [];
		var needsClosedBracket = false;
		for (i=0;i<tokens.length;i++) {
			var t = tokens[i].trim();
			if (t === "") {
				continue;
			}
			console.log(t);
			if (t == "%+" || t == "%-") {
				fairmathedTokens.push(".fairAdd");
				fairmathedTokens.push("(");
				needsClosedBracket = true;
			} else if (t === "true" || t === "false") {
				fairmathedTokens.push(t);
			} else if (t === "or") {
				fairmathedTokens.push("||");
			} else if (t === "and") {
				fairmathedTokens.push("&&");
			} else if (t === "=") {
				fairmathedTokens.push("==");
			} else if (t === "<" || t === ">" || t === "<=" || t === ">=" || t === "!=") {
				fairmathedTokens.push(t);
			} else if (t === "(") {
				if (fairmathedTokens.length>0 && (ALLOWED_TOKENS.indexOf(fairmathedTokens[fairmathedTokens.length-1])===-1 || tokens[fairmathedTokens.length-1]===")")) {
					throw "Syntax Error: "+t+" cannot be preceded by "+fairmathedTokens[fairmathedTokens.length-1]+".";
				}
				fairmathedTokens.push(t);
			} else if (t.match(/^(?:\d+(?:[.]\d*)?)|[.]\d+$/)) {
				fairmathedTokens.push("("+t+")");
				if (needsClosedBracket) {
					fairmathedTokens.push(")");
					needsClosedBracket = false;
				}
			} else {
				fairmathedTokens.push(t);
			}
		}
		console.log(fairmathedTokens.join(""));
		return eval(fairmathedTokens.join(""));
	} else {
		if (calc.match(/".*"/)) { // String
			if (calc.match(/^"([^"]*\\"[^"]*)*"$/)) {
				throw "Syntax Error: String value "+calc+" contains unescaped quotation marks!"
			}
			return calc.substr(1,calc.length-2).replace(/\\"/g,'"');
		} else if (!isNaN(Number(calc))) {
			return calc;
		} else if (calc==="true") {
			return true;
		} else if (calc==="false") {
			return false;
		} else if (typeof globals[calc] !== 'undefined') {
			return globals[calc];
		}
	}
}


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
		choiceSelected = null;
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
	if (node.type === "COMMAND") {
		if (node.command === "choice") { // *CHOICE
			return renderCommandChoice(node, renderStack, html);
		} else if (node.command === "finish") { // *FINISH
			html += '<br><div><button onclick="finishButtonPressed()" name="finishbutton" type="button" class="btn btn-primary">Next Chapter</button></div>\n';
			return [false, renderStack, html];
		} else if (node.command === "create") { // *FINISH
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
		} else if (node.command === "set") { // *SET
			var cmdMatch = node.params.match("([^ \t]+) +(.+)");
			if (!cmdMatch) {
				throw "Line "+node.linenr+": Syntax Error: *set needs to have a variable name and a value!"
			}
			var varname = cmdMatch[1]; // TODO: Throw on illegal variable name
			var value = cmdMatch[2];
			if (!(varname in globals)) {
				throw "Line "+node.linenr+": Runtime Error: no variable with name "+varname+" exists! Create it first using *create"
			} else {
				try {
					globals[varname] = parseCalc(varname, value);
				} catch (e) {
					throw "Line "+node.linenr+": "+e;
				}
			}
		} else if (node.command === "if") {
			var calcResult = null;
			try {
				calcResult = parseCalc(none, node.params.trim());
			} catch (e) {
				throw "Line "+node.linenr+": "+e;
			}
			if (calcResult) {
				renderStack = {"node":node.items[0], "pointer":0, "parent":renderStack};
			} else {
				incrementRenderStack(renderStack);
				// Todo: elseif and else
			}
		}
		// Todo: other commands
	} else if (node.type == "CHOICETARGET") { // #CHOICETARGET
		// Todo: handle error, should never happen!
	} else if (node.type == "PLAINTEXT") { // PLAINTEXT
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