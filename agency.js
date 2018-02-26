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

var lines = scene.split("\n");
lines.forEach((element, index, array) => {
	var matchCommand = element.match("(\s*)[*]([^ ]*)(:? (.*))?");
	var matchChoiceTarget = element.match("(\s*)[#].*");
	if (matchCommand) { // Command
		tokenList.push({"type":"COMMAND","command":matchCommand[2],"params":matchCommand[3]});
	} else if (matchChoiceTarget) { // Choice target
		tokenList.push({"type":"CHOICETARGET","target":matchChoiceTarget[1]});
	} else { // Plain text
		tokenList.push({"type":"PLAINTEXT", "text": element});
	}
});