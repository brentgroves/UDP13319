// https://node.readthedocs.io/en/latest/api/dgram/
var moment = require("moment");
const common = require("@bgroves/common");


async function ProcessToolCounters(mqttClient,toolTracker,msg) 
{
  try
  {
    const transDate = moment(new Date()).format("YYYY-MM-DD HH:mm:ss");
    console.log(`ToolChange transDate=>${transDate}`);


    var length = toolTracker.length;

    var i = 0;
    var rTool = toolTracker[i]; // rTool is a reference to a ToolTracker object.

    var tool = 0; // priming read
    var sTool = msg.slice(tool, tool + 10).toString().trim();
    var nTool = Number(sTool); // returns NaN
    if (Number.isNaN(nTool)) {
      throw new Error(`"Abort: Tool#${rTool.ToolNumber} isNAN`);
    } else {
      console.log(`Common Variable ${rTool.ToolNumber} = ${sTool}`);
    }

    var publishNow=false;
    // ToDo: This could be replaced a variable in tool[].IncrementBy
    if (nTool < 10) 
    {
      /* 
      We need to record the tool change during this time period
      if we have not already done so. 
      
      Depending on when in the CNC cycle the toolsetter performs
      the toolchange this value could be 0 or IncrementBy.
      This code should work for cases where IncrementBy is less than 10.

      PublishedToolChange is initialized to 1 so when the program 
      first starts we will not see this condition as tool change if
      the common variable happens to be less than 10.
      */
      if (rTool.PublishedToolChange === 0) 
      {
        publishNow=true;
      }
    } 
    else 
    {
      // The counter is above 10 so we should have already published
      // any previous tool change if needed; so the next time the
      // counter gets set back to less than 10 a new tool change
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
      // or Counter was rolled back because the tool was still OK. 
      (nTool < rTool.Value) ||  
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
      // ASYNC Problem with Count getting updated before
      // Running Total is updated 
      //let Count = rTool1.RunningTotal; 
      let tcMsg = {
        ToolTrackerKey: rTool.ToolTrackerKey,
        Count: rTool.RunningTotal,
        TransDate: transDate,
      };

      let tcMsgString = JSON.stringify(tcMsg);
      console.log(`Publish ToolChange => ${tcMsgString}`);
//      mqttClient.publish("ToolChange", tcMsgString);
      rTool.PublishedToolChange = 1;
      rTool.RunningTotal=0;  // nTool may have the value IncrementBy so init with 0.
      publishNow = false;
    }
    // Update Value with current Common Variable value just recieved
    rTool.Value = nTool; 
    console.log(`updated rTool.Value=${rTool.Value}`);

  } catch (e) {
    console.log(`caught exception! ${e}`);
  } finally {
    //
  }
};

module.exports = {
  ProcessToolCounters
}
