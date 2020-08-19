// https://node.readthedocs.io/en/latest/api/dgram/
var moment = require("moment");
const common = require("@bgroves/common");


async function ProcessAssemblyCounters(mqttClient,transDate,nCNC_Key,nPart_Key,oPart,idxStart,idxEnd,msg) 
{
  try
  {

    // priming read for loop
    var iMsg = 0; 
    var sCounter = msg.slice(iMsg, iMsg + 10).toString().trim();
    var counter = Number(sCounter); // returns NaN
    if (Number.isNaN(counter)) {
      throw new Error(`"Abort in priming read the 1st counter in datagram isNAN`);
    } else {
      console.log(`oPart.Assembly_Key: ${oPart.Assembly_Key[idxStart]}, Counter = ${sCounter}`);
    }


    var i;
    for (i = idxStart; i < idxEnd; i++) 
    {
      var publishNow=false;
      // CodeChange: Replaced 10 with rTool.IncrementBy
      if (counter <= oPart.IncrementBy[i]) 
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
        if (oPart.PublishedToolChange[i] === 0) 
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
        oPart.PublishedToolChange[i] = 0;
      }

      if ((counter - oPart.IncrementBy[i]) > oPart.Current_Value[i])
      {
        // program may have just started so we need to initialize
        // the running total with this value.  Current_Value and RunningTotals 
        // are initialized to 0' so if counter is 0 nothing will change.
        oPart.RunningTotal[i] = counter;
      }
      else if(
        // Counter was set to 0 and tool was changed 
        // or Counter was rolled back because the tool was still OK
        // But not if Tool setter reset counter in mid cycle before
        // a pallet change and before tool cut. In this case 
        // the running total should not be updated until it has
        // been published as the previous tools tool life.
        ((counter < oPart.Current_Value[i]) && (counter != oPart.IncrementBy[i])) ||  
        // Normal GCode incrementBy for 1 cycle
        ((counter - oPart.IncrementBy[i]) === oPart.Current_Value[i]) 
      ) 
      {
        oPart.RunningTotal[i] += oPart.IncrementBy[i];
      }
      else if ((counter === oPart.Current_Value[i])) {
        // If we will receive the same value multiple times.
        // This should not happen if the call to Tracker.SSB is 
        // put in the correct location.
        // Do nothing in this case.
      }
      console.log(`oPart.RunningTotal[]=${oPart.RunningTotal[i]}`);

      // Publish Tool change if necessary
      if(publishNow)
      {
        let tcMsg = {
          CNC_Key: nCNC_Key,
          Part_Key: nPart_Key,
          Assembly_Key: oPart.Assembly_Key[i],
          Actual_Tool_Life: oPart.RunningTotal[i],
          Trans_Date: transDate,
        };

        let tcMsgString = JSON.stringify(tcMsg);
        console.log(`Published ToolChange => ${tcMsgString}`);
        mqttClient.publish("ToolChange", tcMsgString);
        oPart.PublishedToolChange[i] = 1;
        // counter can be 0 or incrementBy depending on if the tool setter
        // changed the tool in mid cycle.
        oPart.RunningTotal=counter;  
        publishNow = false;
      }

      // Publish CounterUpdate if necessary
      if (counter !== oPart.Current_Value[i]) {
        let tcMsg = {
          CNC_Key: nCNC_Key,
          Part_Key: nPart_Key,
          Assembly_Key: oPart.Assembly_Key[i],
          Current_Value: counter,
          Trans_Date: transDate,
        };

        let tcMsgString = JSON.stringify(tcMsg);
        console.log(`Published UpdateTrackerCurrentValue => ${tcMsgString}`);
        mqttClient.publish("UpdateTrackerCurrentValue", tcMsgString);

      }      

      // Update Value with current Common Variable value just recieved
      oPart.Current_Value[i] = counter; 
      console.log(`updated oPart.Current_Value[]=${oPart.Current_Value[i]}`);
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
