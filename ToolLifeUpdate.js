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
        ToolLife[nCNCApprovedWorkcenterKey][nToolVar].IncrementByCheck = 0;
        ToolLife[nCNCApprovedWorkcenterKey][nToolVar].ZeroDetect = 0;
        common.log(`UDP13319.ToolLifeUpdate=${JSON.stringify(ToolLife[nCNCApprovedWorkcenterKey][nToolVar])}`);
      } catch (err) {
        // handle the error
        common.log(`Error =>${err}`);
      } finally {
        if (conn) conn.release(); //release to pool
      }
    }
    var objToolVar = ToolLife[nCNCApprovedWorkcenterKey][nToolVar];
    if(nToolCounter===0)
    {
      /*
      Case 5:
      Had a case where the previous amh record was 2 less than the tool life and the next amh.record had a current_value of 0. 
      So I believe the tool setter changed the tool 1 set before its tool life. I believe he op stopped the program just before
      this tool was to run and changed it.  I believe he then started the program at that tool and the GCode incremented to the 
      tool counter to its tool life value, but before the call to COM9 was made he reset the counter to 0. A 0 insteaded of 
      the Increment_By value was then recorded in the AMH table.

      In cases like this the running total should be the Increment_By value, and an InsToolLifeHistoryV2 message should be
      published if RunningEntireTime=1.
      */
      common.log(`UDP13319.ToolLifeUpdate().5.nToolCounter=${nToolCounter},RunningEntireTime=${objToolVar.RunningEntireTime},Current_Value=${objToolVar.Current_Value},Running_Total=${objToolVar.Running_Total}`);
      if(objToolVar.RunningEntireTime===1)
      {
          let tcMsg = {
          CNC_Approved_Workcenter_Key: nCNCApprovedWorkcenterKey,
          Tool_Var: nToolVar,
          Run_Quantity: objToolVar.RunningTotal,
          Run_Date: transDate
        };
    
        let tcMsgString = JSON.stringify(tcMsg);
        common.log(`UDP13319.ToolLifeUpdate().6.Published InsToolLifeHistoryV2 => ${tcMsgString}`);
        mqttClient.publish("InsToolLifeHistoryV2", tcMsgString);
      }
      objToolVar.RunningEntireTime = 1;  // This is the start of a new run; so reset this.
      objToolVar.RunningTotal=objToolVar.Increment_By;  // Although the tool counter is 0; I believe this tool has machined 1 set of parts.
      objToolVar.ZeroDetect = 1;  // This Run started at 0 instead of the Increment_By value 
    }
    else if(nToolCounter===objToolVar.Increment_By)
    {
      // I saw a Tool life record with a Run_Quantity of Increment_By and I think
      // the tool setter set the tool life at 0 single stepped through the code calling
      // OCOM9 then checked the tool and the part saw everything was ok so he reset the 
      // tool counter to 0 and restarted the program at the beginning of the tool he 
      // just finished single stepping through which is probably what he should do.  
      // This check is to prevent a tool change from getting recorded twice with an
      // Increment_By value.
      if((1===objToolVar.RunningEntireTime)&&(0===objToolVar.ZeroDetect)&&(objToolVar.RunningTotal>objToolVar.Increment_By))
      {
          /* 
          Case 10:
          1. This run did not start at 0.
          2. The tool was changed and the counter was set to 0.
          3, The new tool assembly has machined exactly 1 set of parts.
          4. This program has run the entire time the previous tool was machinining parts.
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
        objToolVar.RunningTotal=nToolCounter;  // Reset RunningTotal
      }
      // This run did not start at 0.
      // In the case the tool setter is working on the CNC and resets the counter to 0 
      // multiple times we don't want another ToolLife record inserted because we should have
      // just inserted one, but we do want to increment this tool Running_Total.
      // This is a strange occurrence but this condition was detected while testing CNC 120.
      else if((objToolVar.RunningEntireTime===1)&&(0===objToolVar.ZeroDetect)&&(objToolVar.RunningTotal===objToolVar.Increment_By))
      {
        common.log(`UDP13319.ToolLifeUpdate().13A.(objToolVar.RunningEntireTime===1)&&(objToolVar.RunningTotal===objToolVar.Increment_By)`);
        objToolVar.RunningTotal += objToolVar.Increment_By;
      }else if((objToolVar.RunningEntireTime===1)&&(0===objToolVar.ZeroDetect)&&(objToolVar.RunningTotal<objToolVar.Increment_By))
      {
        // This run did not start at 0.
        // I don't think this case will happen.
        // The only time Running_Total should be less than Increment_By is when the program first
        // starts up and in this case RunningEntireTime = 0.
        common.log(`UDP13319.ToolLifeUpdate().13B.(objToolVar.RunningEntireTime===1)&&(0===objToolVar.ZeroDetect)&&(objToolVar.RunningTotal<objToolVar.Increment_By)`);
      }
      else if((objToolVar.RunningEntireTime===0)&&(0===objToolVar.ZeroDetect))
      {
            /* 
          Case 15:
          // This run did not start at 0.
          1. The tool was changed and the counter was set to 0.
          2, The new tool assembly has machined exactly 1 set of parts.
          3. This program has NOT run the entire time.
          4. If the program has not run the entire time then we are not sure the running total is correct
          so don't insert a tool life record.
          */
        common.log(`UDP13319.ToolLifeUpdate().15.objToolVar.RunningEntireTime==${objToolVar.RunningEntireTime};(0===objToolVar.ZeroDetect);objToolVar.RunningTotal==${objToolVar.RunningTotal};`);
        objToolVar.RunningTotal=nToolCounter;  // Reset RunningTotal
      } 
      else if((0===objToolVar.RunningEntireTime)&&(1===objToolVar.ZeroDetect))
      {
            /* 
          Case 16:
          // This run started at 0 instead of Increment_By.
          1. The tool was changed and the counter was set to 0.
          2, The new tool assembly has machined exactly 2 sets of parts since it started at 0.
          3. This program has NOT run the entire time.
          4. If the program has not run the entire time then we are not sure the running total is correct
          so don't insert a tool life record.
          */
        common.log(`UDP13319.ToolLifeUpdate().16.objToolVar.RunningEntireTime==${objToolVar.RunningEntireTime};(0===objToolVar.ZeroDetect);objToolVar.RunningTotal==${objToolVar.RunningTotal};`);
        objToolVar.RunningTotal+=nToolCounter;  // Increment RunningTotal to (2*Increment_By)
      } 
      objToolVar.RunningEntireTime = 1;  // This is the start of a new run; so reset this.  If Run started at zero then this has already been set to zero.
      objToolVar.IncrementByCheck = 1;  // Because sometimes we won't see the counter until
      // it reaches 2 * IncrementBy we use this variable to make sure we still capture the 
      // Tool Life of the previous run.
      objToolVar.ZeroDetect = 0; // We use this variable to determine if we have previously published InsToolLifeHistoryV2.
    }
    else if (nToolCounter === (2*objToolVar.Increment_By))
    {
      /*
      This case happened on T8 of P558 LH 6K Knuckles after the tool chipped and was changed.
      The tool setter changed the tool and single stepped through the code and the counter
      was updated but the COM9 function was not called. He then may have restarted the program 
      from the start of the tool he just single stepped through and may have still been in 
      single step mode.  This time through the counter was updated again and the COM9 function 
      was called.  The result was a long machining time for the tool and a tool counter that
      had a value of 2 * IncrementBy.  In this case which is probably not so uncommon we need
      to make sure that a ToolLife record gets inserted.  
      */
      if(objToolVar.IncrementByCheck==!1)
      { 
        if(objToolVar.RunningEntireTime===1) 
        {
          common.log(`UDP13319.ToolLifeUpdate().16.objToolVar.RunningEntireTime===1;(nToolCounter === (2*objToolVar.Increment_By)`);
            let tcMsg = {
            CNC_Approved_Workcenter_Key: nCNCApprovedWorkcenterKey,
            Tool_Var: nToolVar,
            Run_Quantity: objToolVar.RunningTotal,
            Run_Date: transDate
          };

          let tcMsgString = JSON.stringify(tcMsg);
          common.log(`UDP13319.ToolLifeUpdate().17.Published InsToolLifeHistoryV2 => ${tcMsgString}`);
          mqttClient.publish("InsToolLifeHistoryV2", tcMsgString);
          // so since it has not been set do so now.
        }
        objToolVar.RunningTotal=nToolCounter;  // Reset RunningTotal to 2 * IncrementBy
        objToolVar.RunningEntireTime = 1;  // This is the start of a new run; or very close to it 
      }
      else if(objToolVar.IncrementByCheck===1)
      {
        // In this case we have already set the RunningTotal to the IncrementBy value
        // so we will increment it rather than set it to the IncrementBy value because it is 
        // possible that the RunningTotal is already twice the IncrementBy value.
        objToolVar.RunningTotal+=objToolVar.Increment_By;   
        objToolVar.IncrementByCheck = 0; // reset this to ensure that we publish the next tool change
        // if the tool setter has to single step through the code.
      }
      objToolVar.ZeroDetect = 0; // We use this variable to determine if we have previously published InsToolLifeHistoryV2.
    }
    else if (nToolCounter > (2*objToolVar.Increment_By))
    {
      // This should not happen unless there is a network problem or the UDP app
      // is restarted.
      if ((nToolCounter - objToolVar.Increment_By) > objToolVar.Current_Value)
      {
        /*
        Case 20:
        1. The tool counter has a value > what it should.
        2. We don't know the true RunningTotal value so RunningEntireTime = 0 -- SEE BUG FIX NOTE BELOW
        3. We will not record this run's tool life unless we have only skipped 1 counter value.
        */
       // BUG FIX; Found out that sometimes we miss creating an AMH record either from
       // an intermittent network issue or the node app is being overwhelmed.
       // If only 1 expected counter value is skipped then do not invalidate this run. 
        if((nToolCounter - (2*objToolVar.Increment_By)) > objToolVar.Current_Value)
        {
          objToolVar.RunningEntireTime=0;
        }
        objToolVar.RunningTotal=nToolCounter; // set this be the tool counter value.  
       
        common.log(`UDP13319.ToolLifeUpdate().20.objToolVar.RunningEntireTime=0;nToolCounter=${nToolCounter},objToolVar.Current_Value=${objToolVar.Current_Value}`);
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
      objToolVar.IncrementByCheck = 0; // reset this to ensure that we publish the next tool change
      objToolVar.ZeroDetect = 0; // We use this variable to determine if we have previously published InsToolLifeHistoryV2.
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
