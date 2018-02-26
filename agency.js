var scene = 'Das ist ein\n\
Beispieltext\n\
*set testvar "Hallo"\n\
*choice\n\
	#Wahl 1\n\
		${testvar}, du hast Wahl 1 ausgewählt\n\
		*finish\n\
	#Wahl 2\n\
		${testvar}, du hast Wahl 2 ausgewählt\n\
		*finish';

var tokenList = [];
var indentation = "";

function checkIndent(indent) {
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
        var matchChoiceTarget = element.match("([\t ]*)[#].*");
        if (matchCommand) { // Command
            tokenList.push({
                    "type":"COMMAND",
                    "command":matchCommand[2],
                    "params":matchCommand[3],
                    "indent":checkIndent(matchCommand[1]),
                    "linenr":index+1
                });
        } else if (matchChoiceTarget) { // Choice target
            tokenList.push({
                    "type":"CHOICETARGET","target":matchChoiceTarget[2],
                    "indent":checkIndent(matchChoiceTarget[1]),
                    "linenr":index+1
                });
        } else { // Plain text
            tokenList.push({
                    "type":"PLAINTEXT",
                    "text": element,
                    "indent":checkIndent(element.match("([\t ]*)")[1]),
                    "linenr":index+1
                });
        }
    } catch(err) {
        throw "Line "+(index+1)+": "+err;
    }
});

var prettyTokens = [];
tokenList.forEach((element, index, array) => {
    prettyTokens.push(JSON.stringify(element, null, 4));
});

$("#tokenListDiv").html(prettyTokens.join("<br><br>"));

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

function printableParsedTree(node) {
    var printableParsedTree = {
        };
    
}

tokenList.forEach((element, index, array) => {
    if (element.indent > currentIndent) {
        throw "Line "+element.linenr+": Syntax Error: wrong indentation level!"
    } else if (element.indent <= currentIndent) {
        for (i=currentIndent; i>element.indent; i--) {
            currentParseLevel = currentParseLevel.parent;
        }
    }
    if (element.type == "PLAINTEXT") {
        currentParseLevel.items.push(element);
    } else if (element.type == "COMMAND") {
        if (element.command == "set") {
        } else if (element.command == "choice") {
            addParseLevel(element);
        }
    } else if (element.type == "CHOICETARGET") {
        addParseLevel(element);
    }
});

$("#parsedTreeDiv").html(JSON.stringify(parsedTree, null, 4));