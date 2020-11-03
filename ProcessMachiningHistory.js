// https://node.readthedocs.io/en/latest/api/dgram/
const common = require("@bgroves/common");
const mariadb = require("mariadb");

const {
  MQTT_SERVER,
  MQTT_PORT,
  MYSQL_HOSTNAME,
  MYSQL_PORT,
  MYSQL_USERNAME,
  MYSQL_PASSWORD,
  MYSQL_DATABASE, 
  START_MACHINING, 
  END_MACHINING
} = process.env;

/*
const MQTT_SERVER='localhost';
const MQTT_PORT='1882';
const MYSQL_HOSTNAME= "localhost";
const MYSQL_PORT='3305';
const MYSQL_USERNAME= "brent";
const MYSQL_PASSWORD= "JesusLives1!";
const MYSQL_DATABASE= "Plex";
const  START_MACHINING = 50;
const  END_MACHINING = 51;

*/
const connectionString = {
  connectionLimit: 5,
  multipleStatements: true,
  host: MYSQL_HOSTNAME,
  port: MYSQL_PORT,
  user: MYSQL_USERNAME,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE
}

common.log(`user: ${MYSQL_USERNAME},password: ${MYSQL_PASSWORD}, database: ${MYSQL_DATABASE}, MYSQL_HOSTNAME: ${MYSQL_HOSTNAME}, MYSQL_PORT: ${MYSQL_PORT}`);

const pool = mariadb.createPool( connectionString);

/*
CREATE TABLE Assembly_Machining_History (
	Assembly_Machining_History_Key int NOT NULL AUTO_INCREMENT,
	Plexus_Customer_No int,
	Workcenter_Key	int NOT NULL,  
	CNC_Key int NOT NULL,
	Part_Key int NOT NULL,
	Part_Operation_Key int NOT NULL,
	Assembly_Key int NOT NULL, 
  	Start_Time datetime NOT NULL,  -- This will be updated when the Tool Assembly time starts
  	Run_Time int, -- In seconds.  This will be updated whent the Tool Assembly finishes machining.
  	PRIMARY KEY (Assembly_Machining_History_Key)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COMMENT='History of assembly Machining times';


*/
var Assembly_Machining_History = {};

async function ProcessAssemblyMachiningStart(mqttClient,transDate,nCNCApprovedWorkcenterKey,msg) 
{
    try
    {
        var iMsg = 0; 
        if(msg.length<20)
        {
            throw new Error(`ProcessAssemblyMachingStart msg.length<20`);
        }
        var sToolNo = msg.slice(iMsg, iMsg + 10).toString().trim();
        var nToolNo = Number(sToolNo); // returns NaN
        if(Number.isNaN(nToolNo))
        {
            throw new Error(`ProcessAssemblyMachingStart nToolNo isNAN()`);
        }
        
        iMsg+=10;
        var sPalletNo = msg.slice(iMsg+10, iMsg + 10).toString().trim();
        var nPalletNo = Number(sPalletNo); // returns NaN
        if(Number.isNaN(nPalletNo))
        {
            throw new Error(`ProcessAssemblyMachingStart nPalletNo isNAN()`);
        }
    
        if(Assembly_Machining_History[nCNCApprovedWorkcenterKey] === undefined)
        {
            Assembly_Machining_History[nCNCApprovedWorkcenterKey] = {};
        }
        if(Assembly_Machining_History[nCNCApprovedWorkcenterKey][nPalletNo] === undefined)
        {
            Assembly_Machining_History[nCNCApprovedWorkcenterKey][nPalletNo] = {};

        }
        if(Assembly_Machining_History[nCNCApprovedWorkcenterKey][nPalletNo][nToolNo] === undefined)
        {
            Assembly_Machining_History[nCNCApprovedWorkcenterKey][nPallet_No][nToolNo] = {};

        }
        Assembly_Machining_History[nCNCApprovedWorkcenterKey][Pallet_No][nToolNo].Start_Time = transDate;
    } catch (e) {
        common.log(`caught exception! ${e}`);
    } finally {
        //
    }
}

async function ProcessAssemblyMachiningEnd(mqttClient,transDate,nCNCApprovedWorkcenterKey,msg) 
{
    try
    {
        var iMsg = 0; 
        if(msg.length<20)
        {
            throw new Error(`ProcessAssemblyMachiningEnd msg.length<20`);
        }
        var sToolNo = msg.slice(iMsg, iMsg + 10).toString().trim();
        var nToolNo = Number(sToolNo); // returns NaN
        if(Number.isNaN(nToolNo))
        {
            throw new Error(`ProcessAssemblyMachiningEnd nToolNo isNAN()`);
        }
        
        iMsg+=10;
        var sPalletNo = msg.slice(iMsg+10, iMsg + 10).toString().trim();
        var nPalletNo = Number(sPalletNo); // returns NaN
        if(Number.isNaN(nPalletNo))
        {
            throw new Error(`ProcessAssemblyMachiningEnd nPalletNo isNAN()`);
        }
        if(Assembly_Machining_History[nCNCApprovedWorkcenterKey][nPalletNo][nToolNo].Start_Time === undefined)
        {
            throw new Error(`ProcessAssemblyMachiningEnd StartTime is undefined`);

        }
        Assembly_Machining_History[nCNCApprovedWorkcenterKey][nPallet_No][nToolNo].End_Time = transDate;
        let tcMsg = {
            CNC_Approved_Workcenter_Key: nCNCApprovedWorkcenterKey,
            Pallet_No:nPalletNo,
            Tool_No: nToolNo, 
            Start_Time: Assembly_Machining_History[nCNCApprovedWorkcenterKey][nPalletNo][nToolNo].Start_Time,
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
  ProcessAssemblyMachiningStart,
  ProcessAssemblyMachiningEnd
}

