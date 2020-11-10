// https://node.readthedocs.io/en/latest/api/dgram/
const common = require("@bgroves/common");


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
var ToolAssemblyTimer = {};

async function StartMachining(
  transDate,
  nCNCApprovedWorkcenterKey,
  nPalletNo,
  nToolVar
) {
  try {
    common.log(`UDP13319=>StartMachining->10`);

    if (ToolAssemblyTimer[nCNCApprovedWorkcenterKey] === undefined) {
      ToolAssemblyTimer[nCNCApprovedWorkcenterKey] = {};
    }
    if (ToolAssemblyTimer[nCNCApprovedWorkcenterKey][nPalletNo] === undefined) {
      ToolAssemblyTimer[nCNCApprovedWorkcenterKey][nPalletNo] = {};
    }
    if (
      ToolAssemblyTimer[nCNCApprovedWorkcenterKey][nPalletNo][nToolVar] === undefined
    ) {
      ToolAssemblyTimer[nCNCApprovedWorkcenterKey][nPalletNo][nToolVar] = {};
    }
    ToolAssemblyTimer[nCNCApprovedWorkcenterKey][nPalletNo][
      nToolVar
    ].Start_Time = transDate;
  } catch (e) {
    common.log(`caught exception! ${e}`);
  } finally {
    //
  }
}

async function EndMachining(
  mqttClient,
  transDate,
  nCNCApprovedWorkcenterKey,
  nPalletNo,
  nToolVar
) {
  try {
    common.log(`UDP13319=>EndMachining->10`);
    if (
      ToolAssemblyTimer[nCNCApprovedWorkcenterKey][nPalletNo][nToolVar].Start_Time ===
      undefined
    ) {
      throw new Error(`EndMachining StartTime is undefined`);
    }
    ToolAssemblyTimer[nCNCApprovedWorkcenterKey][nPalletNo][
      nToolVar
    ].End_Time = transDate;
    let tcMsg = {
      CNC_Approved_Workcenter_Key: nCNCApprovedWorkcenterKey,
      Pallet_No: nPalletNo,
      Tool_Var: nToolVar,
      Start_Time:
        ToolAssemblyTimer[nCNCApprovedWorkcenterKey][nPalletNo][nToolVar].Start_Time,
      End_Time: transDate,
    };

    let tcMsgString = JSON.stringify(tcMsg);
    common.log(`Published InsAssemblyMachiningHistory => ${tcMsgString}`);
    mqttClient.publish("InsAssemblyMachiningHistory", tcMsgString);
  } catch (e) {
    common.log(`caught exception! ${e}`);
  } finally {
    //
  }
}



module.exports = {
  StartMachining,
  EndMachining,
};
