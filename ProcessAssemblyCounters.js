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



var CNC_Part_Operation_Assembly = {};


async function ProcessAssemblyCounters(mqttClient,transDate,nCNCPartOperationKey,nSetNo,msg) 
{
  try
  {
    // Number of full 10-byte blocks.
    // There could be a % character at the end of message. 
    var iEnd = Math.trunc(msg.length / 10);

    // Initialize the Current_Value objects CNCPartOperationKey property, and retrieve IncrementBy value
    // if this is the first message for the CNCPartOperationKey,Set_No pair received.
    if (CNC_Part_Operation_Assembly[nCNCPartOperationKey] === undefined)
    {
      CNC_Part_Operation_Assembly[nCNCPartOperationKey] = {};
    }
    if (CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo] === undefined)
    {
      CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo] = {};
         
    }

    /*
     var nBlockNo = 1;
      if (CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo][nBlockNo] === undefined)
      {
        CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo][nBlockNo] = {};
        let conn;
        try {
          conn = await pool.getConnection();      
          const resultSets = await conn.query('call GetIncrementBy(?,?,?,@IncrementBy,@ReturnValue); select @IncrementBy as pIncrementBy,@ReturnValue as pReturnValue',[nCNCPartOperationKey,nSetNo,nBlockNo]);
          let incrementBy = resultSets[1][0].pIncrementBy;
          let returnValue = resultSets[1][0].pReturnValue;
          common.log(`GetIncrementBy.incrementBy=${incrementBy},returnValue=${returnValue}`);
          CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo][nBlockNo].Increment_By = incrementBy;
          CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo][nBlockNo].PublishedToolChange = 1;
          CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo][nBlockNo].RunningTotal = 0;
          CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo][nBlockNo].Current_Value = 0;
          common.log(`CNC_Part_Operation_Assembly=${JSON.stringify(CNC_Part_Operation_Assembly)}`);
        } catch (err) {
          // handle the error
          console.log(`Error =>${err}`);
        } finally {
          if (conn) conn.release(); //release to pool
        }
           
      }

    return;
*/    
    // priming read for loop
    var iMsg = 0; 
    var sCounter = msg.slice(iMsg, iMsg + 10).toString().trim();
    var counter = Number(sCounter); // returns NaN
    if (Number.isNaN(counter)) {
      throw new Error(`"Abort in priming read the 1st counter in datagram isNAN`);
    } else {
      console.log(`msg=${msg}`);
    }

    var nBlockNo;
    for (nBlockNo = 1; nBlockNo <= iEnd; nBlockNo++) 
    {
      if (CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo][nBlockNo] === undefined)
      {
        CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo][nBlockNo] = {};
        let conn;
        try {
          conn = await pool.getConnection();      
          const resultSets = await conn.query('call GetIncrementBy(?,?,?,@IncrementBy,@ReturnValue); select @IncrementBy as pIncrementBy,@ReturnValue as pReturnValue',[nCNCPartOperationKey,nSetNo,nBlockNo]);
          let incrementBy = resultSets[1][0].pIncrementBy;
          // let returnValue = resultSets[1][0].pReturnValue;
          CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo][nBlockNo].Increment_By = incrementBy;
          CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo][nBlockNo].PublishedToolChange = 1;
          CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo][nBlockNo].RunningTotal = 0;
          CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo][nBlockNo].Current_Value = 0;
          common.log(`Start => CNC_Part_Operation_Assembly=${JSON.stringify(CNC_Part_Operation_Assembly)}`);

        } catch (err) {
          // handle the error
          console.log(`Error =>${err}`);
        } finally {
          if (conn) conn.release(); //release to pool
        }
           
      }
      var currentAssembly = CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo][nBlockNo];
      var publishNow=false;
      // CodeChange: Replaced 10 with rTool.IncrementBy
      if (counter <= currentAssembly.Increment_By) 
      {
        /* 
        We need to record the tool change during this time period
        if we have not already done so. 
        
        Depending on when in the CNC cycle the toolsetter performs
        the toolchange this value could be 0 or IncrementBy.

        PublishedToolChange is initialized to 1 so when the program 
        first starts we will not see this condition as tool change if
        the common variable happens to be less than or equal to the IncrementBy value.
        */
        if (currentAssembly.PublishedToolChange === 0) 
        {
          publishNow=true;
        }
      } 
      else 
      {
        // The counter is above IncrementBy value so we should have already published
        // any previous tool change if needed; so the next time the
        // counter gets set back to less than the IncrementBy value a new tool change
        // probably occurred and we need to Publish it.
        currentAssembly.PublishedToolChange = 0;
      }

      if ((counter - currentAssembly.Increment_By) > currentAssembly.Current_Value)
      {
        // program may have just started so we need to initialize
        // the running total with this value.  Current_Value and RunningTotals 
        // are initialized to 0' so if counter is 0 nothing will change.
        currentAssembly.RunningTotal = counter;
      }
      else if(
/*
https://www.tothenew.com/mean-node-js-development-consulting
https://github.com/brentgroves/Okuma13319
NST1   (Program cycle starts here)
CALL OXXX0 PL=1  (Safety program)
CALL OTLM  (Check tool life for every assembly)
(CALL OZLX)  (Don't know what this is)
G30P1
B0.
M60
M208 (THIS IS WHERE THE TOOL COUNTERS ARE OUTPUT TO THE COM PORT. VC40 MUST EQUAL 1 TO WORK)
...
GOTO NST1

https://github.com/brentgroves/UDP13319
ProcessAssemblyCounters.js - Program that processes the output that results from the 
execution of the M208 command.

Case 1:
1. Cycle completes and all counters have been incremented, 
2. program jumps to NST1.
3. OTLM is executed and a tool life condition was found.
4. At this point M208 has not yet recorded the latest tool counter increments.
5. The tool setter changes the tool and resets the counter to 0.
6. The program is reset and OTLM is executed with no alarms.
7. A pallet change occurs and the tool counter reader subroutine, OCOM1.SSB, is ran.
8. This function, ProcessAssemblyCounters(),is processed and finds the tool counter equal to 0. 
9. The running total IS incremented.
10. The tool life is recorded.

Case 2:
1. Before the cycle completes the tool setter changes the tool.
2. The tool setter resets the counter to 0.
3. The tool setter starts the program from where he stopped it probably at an M01 instruction.
4. The tool counter is incremented.
5. The cycle completes and the program jumps to instruction NST1.
6. Subroutine OTLM.SSB executes without alarms.
7. A pallet change occurs and the tool counter subroutine, OCOM1.SSB, is ran.
8. This function, ProcessAssemblyCounters(), is processed and finds the tool counter equal to the Increment_By value.
9. We do NOT increment RunningTotal.
10. The tool life is recorded.

Case 3: (Non-Aluminum job)
1. The tool setter examines the tool assembly and decides not to change the tooling.
2. The tool setter rolls back the tool counter. 
3. This function, ProcessAssemblyCounters(), is executed and the RunningTotal is incremented.

Case 4: (Aluminum jobs)
1. The tool setter examines the tool assembly and decides not to change the tooling.
2. The tool setter increase the tool life in OTLM.SSB.
3. This function, ProcessAssemblyCounters(), is executed and the RunningTotal is incremented.
*/        
        // Counter was set to 0 and tool was changed 
        // or Counter was rolled back because the tool was still OK
        // But not if Tool setter reset counter in mid cycle before
        // a pallet change and before tool cut. In this case 
        // the running total should not be updated until it has
        // been published as the previous tools tool life.
        ((counter < currentAssembly.Current_Value) && (counter != currentAssembly.Increment_By)) ||  
        // Normal GCode incrementBy for 1 cycle
        ((counter - currentAssembly.Increment_By) === currentAssembly.Current_Value) 
      ) 
      {
        currentAssembly.RunningTotal += currentAssembly.Increment_By;
      }
      else if ((counter === currentAssembly.Current_Value)) {
        // If we will receive the same value multiple times.
        // This should not happen if the call to Tracker.SSB is 
        // put in the correct location.
        // Do nothing in this case.
      }
      console.log(`currentAssembly=${JSON.stringify(currentAssembly)}`);

      // Publish Tool change if necessary
      if(publishNow)
      {
        //  CNC_Part_Operation_Assembly[nCNCPartOperationKey][nSetNo][nBlockNo]
        //[nCNCPartOperationKey,nSetNo,nBlockNo]);

        let tcMsg = {
          CNC_Part_Operation_Key: nCNCPartOperationKey,
          Set_No: nSetNo,
          Block_No: nBlockNo,
          Actual_Tool_Assembly_Life: currentAssembly.RunningTotal,
          Trans_Date: transDate,
        };

        let tcMsgString = JSON.stringify(tcMsg);
        console.log(`Published InsToolAssemblyChangeHistory => ${tcMsgString}`);
        mqttClient.publish("InsToolAssemblyChangeHistory", tcMsgString);
        currentAssembly.PublishedToolChange = 1;
        // counter can be 0 or incrementBy depending on if the tool setter
        // changed the tool in mid cycle.
        currentAssembly.RunningTotal=counter;  
        publishNow = false;
      }

      // Publish Counter Update and Fastest Cycle time check if necessary
      if (counter !== currentAssembly.Current_Value) {
        let tcMsg = {
          CNC_Part_Operation_Key: nCNCPartOperationKey,
          Set_No: nSetNo,
          Block_No: nBlockNo,
          Current_Value: counter,
          Last_Update: transDate
        };

        let tcMsgString = JSON.stringify(tcMsg);
        console.log(`Published UpdateCNCPartOperationAssembly => ${tcMsgString}`);
        mqttClient.publish("UpdateCNCPartOperationAssembly", tcMsgString);

      }      

      // Update Value with current Common Variable value just recieved
      currentAssembly.Current_Value = counter; 
      console.log(`updated currentAssembly.Current_Value=${currentAssembly.Current_Value}`);
      // increment msg pointer 
      if((iMsg + 10) <= msg.length)
      {
        iMsg += 10; 
        sCounter = msg.slice(iMsg, iMsg + 10).toString().trim();
        counter = Number(sCounter); // returns NaN
      }
    }
  } catch (e) {
    console.log(`caught exception! ${e}`);
  } finally {
    //
  }
}

module.exports = {
  ProcessAssemblyCounters
}
