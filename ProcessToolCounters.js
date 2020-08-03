// https://node.readthedocs.io/en/latest/api/dgram/
var moment = require("moment");
const common = require("@bgroves/common");


async function ProcessToolCounters(mqttClient,transDate,nCNC,datagram,msg) 
{
  try
  {
    // priming read for loop
    var i = 0; 
    var sCounter = msg.slice(i, i + 10).toString().trim();
    var counter = Number(sCounter); // returns NaN
    if (Number.isNaN(counter)) {
      throw new Error(`"Abort in priming read the 1st counter in datagram isNAN`);
    } else {
      console.log(`ToolListItemKey: ${datagram[0].ToolListItemKey}, Counter = ${sCounter}`);
    }

    for (var rTool of datagram) 
    {
      var publishNow=false;
      // CodeChange: Replaced 10 with rTool.IncrementBy
      if (counter <= rTool.IncrementBy) 
      {
        /* 
        We need to record the tool change during this time period
        if we have not already done so. 
        
        Depending on when in the CNC cycle the toolsetter performs
        the toolchange this value could be 0 or IncrementBy.

        PublishedToolChange is initialized to 1 so when the program 
        first starts we will not see this condition as tool change if
        the common variable happens to be less than the IncrementBy value.
        */
        if (rTool.PublishedToolChange === 0) 
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
        rTool.PublishedToolChange = 0;
      }

      if ((counter - rTool.IncrementBy) > rTool.Value)
      {
        // program may have just started so we need to initialize
        // the running total with this value.
        rTool.RunningTotal = counter;
      }
      else if(
        // Counter was set to 0 and tool was changed 
        // or Counter was rolled back because the tool was still OK
        // But not if Tool setter reset counter in mid cycle before
        // a pallet change and before tool cut. In this case 
        // the running total should not be updated until it has
        // been published as the previous tools tool life.
        ((counter < rTool.Value) && (counter != rTool.IncrementBy)) ||  
        // Normal GCode incrementBy for 1 cycle
        ((counter - rTool.IncrementBy) === rTool.Value) 
      ) 
      {
        rTool.RunningTotal += rTool.IncrementBy;
      }
      else if ((counter === rTool.Value)) {
        // Since the GCode subroutine gets called every pallet change
        // we will receive the same value multiple times.
        // Do nothing in this case.
      }
      console.log(`rTool.RunningTotal=${rTool.RunningTotal}`);

      if(publishNow)
      {
        let tcMsg = {
          ToolListItemKey: rTool.ToolListItemKey,
          CNC: nCNC,
          ToolLife: rTool.RunningTotal,
          TransDate: transDate,
        };

        let tcMsgString = JSON.stringify(tcMsg);
        console.log(`Published ToolChange => ${tcMsgString}`);
        mqttClient.publish("ToolChange", tcMsgString);
        rTool.PublishedToolChange = 1;
        // counter can be 0 or incrementBy depending on if the tool setter
        // changed the tool in mid cycle.
        rTool.RunningTotal=counter;  
        publishNow = false;
      }
      // Update Value with current Common Variable value just recieved
      rTool.Value = counter; 
      console.log(`updated rTool.Value=${rTool.Value}`);
      // increment msg pointer 
      if((i + 10) <= msg.length)
      {
        i += 10; 
        sCounter = msg.slice(i, i + 10).toString().trim();
        counter = Number(sCounter); // returns NaN
      }
    }
  } catch (e) {
    console.log(`caught exception! ${e}`);
  } finally {
    //
  }
};

module.exports = {
  ProcessToolCounters
}
