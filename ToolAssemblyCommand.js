// https://node.readthedocs.io/en/latest/api/dgram/
const common = require("@bgroves/common");
const timer = require('./ToolAssemblyTimer');
const toolLife = require('./ToolLifeUpdate');

const {
  START_MACHINING,
  END_MACHINING,
  END_MACHINING_NO_TIMER,
} = process.env;



/*
CREATE TABLE ToolAssembly (
	ToolAssembly_Key int NOT NULL AUTO_INCREMENT,
	Plexus_Customer_No int,
	Workcenter_Key	int NOT NULL,  
	CNC_Key int NOT NULL,
	Part_Key int NOT NULL,
	Part_Operation_Key int NOT NULL,
	Assembly_Key int NOT NULL, 
  	Start_Time datetime NOT NULL,  -- This will be updated when the Tool Assembly time starts
  	Run_Time int, -- In seconds.  This will be updated whent the Tool Assembly finishes machining.
  	PRIMARY KEY (ToolAssembly_Key)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COMMENT='History of assembly Machining times';


*/
// var ToolAssembly = {};



async function ProcessToolAssemblyCommand(
  mqttClient,
  transDate,
  nCNCApprovedWorkcenterKey,
  msg
) {
  try {
    common.log(`30. UDP13319=>ProcessToolAssemblyCommand`);

    var iMsg = 0;
    if (msg.length < 40) {
      throw new Error(`ProcessToolAssemblyCommand msg.length<30`);
    }
    var sCmd = msg
      .slice(iMsg, iMsg + 10)
      .toString()
      .trim();
    var nCmd = Number(sCmd); // returns NaN
    if (Number.isNaN(nCmd)) {
      throw new Error(`ProcessToolAssemblyCommand nCmd isNAN()`);
    }
    iMsg += 10;
    var sPalletNo = msg
      .slice(iMsg, iMsg + 10)
      .toString()
      .trim();
    var nPalletNo = Number(sPalletNo); // returns NaN
    if (Number.isNaN(nPalletNo)) {
      throw new Error(`ProcessToolAssemblyCommand nPalletNo isNAN()`);
    }

    iMsg += 10;
    var sToolVar = msg
      .slice(iMsg, iMsg + 10)
      .toString()
      .trim();
    var nToolVar = Number(sToolVar); // returns NaN
    if (Number.isNaN(nToolVar)) {
      throw new Error(`ProcessToolAssemblyCommand nToolVar isNAN()`);
    }

    iMsg += 10;
    var sToolCounter = msg
      .slice(iMsg, iMsg + 10)
      .toString()
      .trim();
    var nToolCounter = Number(sToolCounter); // returns NaN
    if (Number.isNaN(nToolCounter)) {
      throw new Error(`ProcessToolAssemblyCommand nCounter isNAN()`);
    }

    switch (sCmd) {
      case START_MACHINING:
        timer.StartMachining(
          transDate,
          nCNCApprovedWorkcenterKey,
          nPalletNo,
          nToolVar
        );
        break;
      case END_MACHINING:
        await toolLife.ToolLifeUpdate(
          mqttClient,
          transDate,
          nCNCApprovedWorkcenterKey,
          nToolVar,
          nToolCounter
        );
        timer.EndMachining(
          mqttClient,
          transDate,
          nCNCApprovedWorkcenterKey,
          nPalletNo,
          nToolVar
        );
        break;
      case END_MACHINING_NO_TIMER:
        break;
      default:
        throw new Error(`ProcessAssemblyMachining invalid command`);
        break;
    }
  } catch (e) {
    common.log(`caught exception! ${e}`);
  } finally {
    //
  }
}

module.exports = {
  ProcessToolAssemblyCommand,
};
