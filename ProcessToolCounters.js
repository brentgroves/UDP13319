// https://node.readthedocs.io/en/latest/api/dgram/
var moment = require("moment");
const common = require("@bgroves/common");


async function ProcessToolCounters(mqttClient,toolsInDatagram,msg) 
{
  try
  {
    const transDate = moment(new Date()).format("YYYY-MM-DD HH:mm:ss");
    console.log(`ToolChange transDate=>${transDate}`);

    // priming read for loop
    var tool = 0; 
    var sTool = msg.slice(tool, tool + 10).toString().trim();
    var nTool = Number(sTool); // returns NaN
    if (Number.isNaN(nTool)) {
      throw new Error(`"Abort in priming read the 1st tool in datagram isNAN`);
    } else {
      console.log(`Common Variable: ${toolsInDatagram[0].ToolNumber} = ${sTool}`);
    }

    for (var rTool of toolsInDatagram) 
    {
      var publishNow=false;
      // CodeChange: Replaced 10 with rTool.IncrementBy
      if (nTool <= rTool.IncrementBy) 
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

      if ((nTool - rTool.IncrementBy) > rTool.Value)
      {
        // program may have just started so we need to initialize
        // the running total with this value.
        rTool.RunningTotal = nTool;
      }
      else if(
        // Counter was set to 0 and tool was changed 
        // or Counter was rolled back because the tool was still OK
        // But not if Tool setter reset counter in mid cycle before
        // a pallet change and before tool cut. In this case 
        // the running total should not be updated until it has
        // been published as the previous tools tool life.
        ((nTool < rTool.Value) && (nTool != rTool.IncrementBy)) ||  
        // Normal GCode incrementBy for 1 cycle
        ((nTool - rTool.IncrementBy) === rTool.Value) 
      ) 
      {
        rTool.RunningTotal += rTool.IncrementBy;
      }
      else if ((nTool === rTool.Value)) {
        // Since the GCode subroutine gets called every pallet change
        // we will receive the same value multiple times.
        // Do nothing in this case.
      }
      console.log(`rTool.RunningTotal=${rTool.RunningTotal}`);

      if(publishNow)
      {
        let tcMsg = {
          ToolTrackerKey: rTool.toolTrackerKey,
          ToolLife: rTool.RunningTotal,
          TransDate: transDate,
        };

        let tcMsgString = JSON.stringify(tcMsg);
        console.log(`Published ToolChange => ${tcMsgString}`);
        mqttClient.publish("ToolChange", tcMsgString);
        rTool.PublishedToolChange = 1;
        // nTool can be 0 or incrementBy depending on if the tool setter
        // changed the tool in mid cycle.
        rTool.RunningTotal=nTool;  
        publishNow = false;
      }
      // Update Value with current Common Variable value just recieved
      rTool.Value = nTool; 
      console.log(`updated rTool.Value=${rTool.Value}`);
      // increment msg pointer 
      if((tool + 10) <= msg.length)
      {
        tool += 10; 
        sTool = msg.slice(tool, tool + 10).toString().trim();
        nTool = Number(sTool); // returns NaN
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
