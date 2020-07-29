// https://node.readthedocs.io/en/latest/api/dgram/
var udp = require("dgram");
const mqtt = require("mqtt");
var moment = require("moment");
const config = require("../Config13319/config.json");
const common = require("@bgroves/common");
const { exit } = require("process");
const { start } = require("repl");

var { MQTT_SERVER, UDP_PORT } = process.env;
// const MQTT_SERVER = 'localhost';
// const UDP_PORT = 2222;
var nextLine = 1;
// --------------------creating a udp server --------------------

common.log(`UDP13319.1 ->config.tools[0].Count=>${config.tools[0].Count}`);

async function main() {
  const mqttClient = mqtt.connect(`mqtt://${MQTT_SERVER}`);

  // creating a udp server
  var server = udp.createSocket("udp4");

  // emits when any error occurs
  server.on("error", function (error) {
    common.log("Error: " + error);
    server.close();
  });

  // emits on new datagram msg
  server.on("message", function (msg, info) {
    try {
      common.log("Data received from client : " + msg.toString());
      common.log(`Data received in hex =>${msg.toString("hex")}`);
      common.log("Received %d bytes from %s:%d\n", msg.length);
      // We recieve DC2,%,DC4 in datagrams by themself but receive all the common variable in one datagram.
      if (msg.length < 3) {
        common.log(`Abort: msg.length<3`);
        return;
      }

      const transDate = moment(new Date()).format("YYYY-MM-DD HH:mm:ss");
      common.log(`ToolChange transDate=>${transDate}`);

      // We receive up to 10 fixed length records in one datagram.  If we have more than 10 fixed length units
      // that are being sent then we will receive them in multiple datagrams.
      if (nextLine == 1) {
        nextLine = 2; // the next datagram to be recieved should be line #2 with the 11th through 20th fixed length units.
        let startChar = 0;
        if (0x12 == msg[0]) {
          common.log(`Increment startChar: 0x12==msg[0]`);
          startChar++; // sometimes DC2 will arrive with line #1 and sometimes it is in a datagram by itself.
        }

        var cnc = msg.slice(startChar, startChar + 10);
        var sCNC = cnc.toString().trim();
        var nCNC = Number(sCNC); // returns NaN
        if (Number.isNaN(nCNC)) {
          throw new Error("Abort: sCNC isNAN");
        } else {
          common.log(`CNC = ${sCNC}`);
        }

        // TODO: PARSE OriginalProcessID
        /*
        var originalProcessID = startChar + 10;
        var sOriginalProcessID = msg.slice(originalProcessID, originalProcessID + 10);
        var nOriginalProcessID = Number(sOriginalProcessID); // returns NaN
        if (Number.isNaN(nOriginalProcessID)) {
          throw new Error("OriginalProcessID isNAN");
        } else {
          common.log(`OriginalProcessID=${sOriginalProcessID}`);
          // 
        }

*/
        let nOriginalProcessID = 49396; // Replace this line with the code above.
        
        // All Data collected from the Okuma should be in the format of CNC,ToolList OriginalProcessID,Part Counter,
        // Tool counters.  The OriginalProcessID is included in case the CNC is setup to run multiple jobs.
        // Currently, CNC 103 is not outputing the ToolList OriginalProcessID

        // TODO: Change this line to originalProcessID + 10 after adding code above
        var partCounter = startChar + 10;
        var sPartCounter = msg.slice(partCounter, partCounter + 10).toString().trim();
        var nPartCounter = Number(sPartCounter); // returns NaN
        if (Number.isNaN(nPartCounter)) {
          throw new Error("Abort: PartCounter isNAN");
        } else {
          common.log(`PartCounter=${sPartCounter}`);
          //
        }
        //  looks through each element and stops at first match.
        // Make sure first match is the part counter node.
        let iNode = config.nodes.findIndex((el) => el.cnc === sCNC); // returns '4 foot tail'
        common.log(`sCNC=${sCNC},iNode = ${iNode}`)
        // Only publish if value has changed.
        if(nPartCounter!==config.nodes[iNode].value)
        {
          let kepMsg = {
            updateId: config.nodes[iNode].updateId,
            nodeId: config.nodes[iNode].nodeId,
            name: config.nodes[iNode].name,
            plexus_Customer_No: config.nodes[iNode].plexus_Customer_No,
            pcn: config.nodes[iNode].pcn,
            workcenter_Key: config.nodes[iNode].workcenter_Key,
            workcenter_Code: config.nodes[iNode].workcenter_Code,
            cnc: config.nodes[iNode].cnc,
            value: nPartCounter,
            transDate: transDate,
          };

          let kepMsgString = JSON.stringify(kepMsg);
          common.log(`Kep13319 publish => ${kepMsgString}`);
          mqttClient.publish("Kep13319", kepMsgString);
          config.nodes[iNode].value=nPartCounter;
        }

        // TODO: Add this code to a subroutine
        var tool1 = partCounter + 10;
        var sTool1 = msg.slice(tool1, tool1 + 10).toString().trim();
        var nTool1 = Number(sTool1); // returns NaN
        if (Number.isNaN(nTool1)) {
          throw new Error("Abort: Tool1 isNAN");
        } else {
          common.log(`Tool1 has the value: ${sTool1}`);
        }

        // Returns an index of the 1st tool for this CNC/OriginalProcessID combination
        let iTool1 = config.tools.findIndex((el) => {
          if (
            el.CNC === nCNC &&
            el.OriginalProcessID === nOriginalProcessID &&
            1 === el.CNC_PID_Index  // tool1's CNC_PID_Index = 1;
          ) {
            return true;
          } else {
            return false;
          }
        });
        var rTool1 = config.tools[iTool1]; // rTool1 is a reference to the tool1 config.tools[] element.
        // ToDo: This could be replaced a variable in tool[].IncrementBy
        if (nTool1 < 10) {
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
          if (rTool1.PublishedToolChange === 0) {
            /*
            	ToolTrackerKey int(11) NOT NULL,
              Count int NOT NULL,
              TransDate datetime NOT NULL,
            */

            let tcMsg = {
              ToolTrackerKey: rTool1.ToolTrackerKey,
              Count: rTool1.RunningTotal,
              TransDate: transDate,
            };

            let tcMsgString = JSON.stringify(tcMsg);
            common.log(`Publish to ToolChange => ${tcMsgString}`);
            mqttClient.publish("ToolChange", tcMsgString);
            rTool1.PublishedToolChange = 1;
          }
        } else {
          // The counter is above 10 so we should have already published
          // any previous tool change if needed; so the next time the
          // counter gets set back to less than 10 a new tool change
          // probably occurred and we need to Publish it.
          rTool1.PublishedToolChange = 0;
        }

        if ((nTool1 - rTool1.IncrementBy) > rTool1.Value)
        {
          // program may have just started so we need to initialize
          // the running total with this value.
          rTool1.RunningTotal = nTool1;
        }
        else if(
          // Counter was set to 0 and tool was changed 
          // or Counter was rolled back because the tool was still OK. 
          (nTool1 < rTool1.Value) ||  
          // Normal GCode incrementBy for 1 cycle
          ((nTool1 - rTool1.IncrementBy) === rTool1.Value) 
        ) 
        {
          config.tools[iTool1].RunningTotal += rTool1.IncrementBy;
        }
        else if ((nTool1 === rTool1.Value)) {
          // Since the GCode subroutine gets called every pallet change
          // we will receive the same value multiple times.
          // Do nothing in this case.
        }
        common.log(`rTool1.RunningTotal=${rTool1.RunningTotal}`);
        // Update Value with current Common Variable value just recieved
        rTool1.Value = nTool1; 
        common.log(`rTool1.Value=${rTool1.Value}`);

      } else {
        nextLine = 1;
        let startCharLine2 = msg.indexOf(":", 0);
        startCharLine2 = startCharLine2 + 1;
        common.log(`Processed line 2`);
        // Since every item we are sending has a fixed length of 10
        // And we always send the CNC and OriginalProcessID and the
        // datagrams will only pass 10 of these fixed length units
        // at a time this buffer we call Line 2 should start with
        // tool9's value.
        // var tool9 = startCharLine2;
      }
    } catch (e) {
      common.log(`caught exception! ${e}`);
    } finally {
      //
    }
  });

  //emits when socket is ready and listening for datagram msgs
  server.on("listening", function () {
    var address = server.address();
    var port = address.port;
    var family = address.family;
    var ipaddr = address.address;
    common.log(`UDP Server is listening`);
  });

  //emits after the socket is closed using socket.close();
  server.on("close", function () {
    common.log("Socket is closed !");
  });
  server.bind(UDP_PORT);
}

main();
