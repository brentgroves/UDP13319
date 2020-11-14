// https://node.readthedocs.io/en/latest/api/dgram/
const common = require("@bgroves/common");
const mariadb = require("mariadb");
const toolLife = require("./global");

const {
  MYSQL_HOSTNAME,
  MYSQL_PORT,
  MYSQL_USERNAME,
  MYSQL_PASSWORD,
  MYSQL_DATABASE
} = process.env;
/*
const MQTT_SERVER='localhost';
const MQTT_PORT='1882';
const MYSQL_HOSTNAME= "localhost";
const MYSQL_PORT='3305';
const MYSQL_USERNAME= "brent";
const MYSQL_PASSWORD= "JesusLives1!";
const MYSQL_DATABASE= "mach2";
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

const ToolLife = toolLife.ToolLife;

async function ToolLifeUpdate(mqttClient,transDate,nCNCApprovedWorkcenterKey,nToolVar,nToolCounter) 
{
  try
  {

    // Initialize the Current_Value objects CNCApprovedWorkcenterKey, property, and retrieve IncrementBy value
    // if this is the first message for the CNCApprovedWorkcenterKey,Set_No pair received.
    if (ToolLife[nCNCApprovedWorkcenterKey] === undefined)
    {
      ToolLife[nCNCApprovedWorkcenterKey] = {};
    }
    if (ToolLife[nCNCApprovedWorkcenterKey][nToolVar] === undefined)
    {
      ToolLife[nCNCApprovedWorkcenterKey][nToolVar] = {};
      let conn;
      try {
        conn = await pool.getConnection();      
        const resultSets = await conn.query('call GetCounterIncrement(?,?,@IncrementBy,@ReturnValue); select @IncrementBy as pIncrementBy,@ReturnValue as pReturnValue',[nCNCApprovedWorkcenterKey,nToolVar]);
        let incrementBy = resultSets[1][0].pIncrementBy;
        // let returnValue = resultSets[1][0].pReturnValue;
        ToolLife[nCNCApprovedWorkcenterKey][nToolVar].Increment_By = incrementBy;
        ToolLife[nCNCApprovedWorkcenterKey][nToolVar].RunningTotal = 0;
        ToolLife[nCNCApprovedWorkcenterKey][nToolVar].Current_Value = 0;
        ToolLife[nCNCApprovedWorkcenterKey][nToolVar].RunningEntireTime = 0;
        common.log(`UDP13319.ToolLifeUpdate=${JSON.stringify(ToolLife[nCNCApprovedWorkcenterKey][nToolVar])}`);
      } catch (err) {
        // handle the error
        common.log(`Error =>${err}`);
      } finally {
        if (conn) conn.release(); //release to pool
      }
    }
    var objToolVar = ToolLife[nCNCApprovedWorkcenterKey][nToolVar];
    if(nToolCounter===objToolVar.Increment_By)
    {
      if(objToolVar.RunningEntireTime===1)
      {
          /* 
          Case 10:
          1. The tool was changed and the counter was set to 0.
          2, The new tool assembly has machined exactly 1 set of parts.
          3. This program has run the entire time the previous tool was machinining parts.
          */
          common.log(`UDP13319.ToolLifeUpdate().10.objToolVar.RunningEntireTime===1;`);
          let tcMsg = {
          CNC_Approved_Workcenter_Key: nCNCApprovedWorkcenterKey,
          Tool_Var: nToolVar,
          Run_Quantity: objToolVar.RunningTotal,
          Run_Date: transDate
        };
    
        let tcMsgString = JSON.stringify(tcMsg);
        common.log(`UDP13319.ToolLifeUpdate().12.Published InsToolLifeHistoryV2 => ${tcMsgString}`);
        mqttClient.publish("InsToolLifeHistoryV2", tcMsgString);
 
      }else{
          /* 
          Case 15:
          1. The tool was changed and the counter was set to 0.
          2, The new tool assembly has machined exactly 1 set of parts.
          3. This program has NOT run the entire time.
          */
        common.log(`UDP13319.ToolLifeUpdate().15.objToolVar.RunningEntireTime!==1;`);
      } 
      objToolVar.RunningTotal=nToolCounter;  // Reset RunningTotal
      objToolVar.RunningEntireTime = 1;  // This is the start of a new run; so reset this.



    }
    else if (nToolCounter > objToolVar.Increment_By)
    {
      if ((nToolCounter - objToolVar.Increment_By) > objToolVar.Current_Value)
      {
        /*
        Case 20:
        1. This code has not been running the entire time this 
        tool has been machining.
        2. The tool counter has a value > what it should.
        3. We don't know the true RunningTotal value so RunningEntireTime = 0
        4. We will not record this run's tool life.
        */
       objToolVar.RunningEntireTime=0;
       objToolVar.RunningTotal=nToolCounter; // catch up to what it should be.
       common.log(`UDP13319.ToolLifeUpdate().20.objToolVar.RunningEntireTime=0;`);
      }
      else if((nToolCounter - objToolVar.Increment_By) === objToolVar.Current_Value)
      {
        /*
        Case 25:
        1. The tool assembly has machined exactly 1 set of parts.
        */
        objToolVar.RunningTotal += objToolVar.Increment_By;
        common.log(`UDP13319.ToolLifeUpdate().25.objToolVar.RunningTotal += objToolVar.Increment_By;`);
      }
      else if((nToolCounter - objToolVar.Increment_By) < objToolVar.Current_Value)
      {
        /*
        Case 28:
        1. The tool counter has been moved back.
        */
        objToolVar.RunningTotal += objToolVar.Increment_By;
        common.log(`UDP13319.ToolLifeUpdate().28.objToolVar.RunningTotal += objToolVar.Increment_By;`);
     }
    }
    else if (nToolCounter < objToolVar.Increment_By)
    {
      /*
      Case 30:
      1. If CNC output is done right after tool counter increment this 
      case should never happen.
      */
      common.log(`UDP13319.ToolLifeUpdate().30.nToolCounter < objToolVar.Increment_By`);
    }
    objToolVar.Current_Value = nToolCounter;
    let tcMsg = {
      CNC_Approved_Workcenter_Key: nCNCApprovedWorkcenterKey,
      Tool_Var: nToolVar,
      Current_Value: nToolCounter,
      Running_Total: objToolVar.RunningTotal,
      Last_Update: transDate
    };

    let tcMsgString = JSON.stringify(tcMsg);
    common.log(`UDP13319.ToolLifeUpdate().40.Published UpdateCNCToolOpPartLifeV2 => ${tcMsgString}`);
    mqttClient.publish("UpdateCNCToolOpPartLifeV2", tcMsgString);

  } catch (e) {
    common.log(`caught exception! ${e}`);
  } finally {
    //
  }
}

module.exports = {
  ToolLifeUpdate
}
