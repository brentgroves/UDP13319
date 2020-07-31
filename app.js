// https://node.readthedocs.io/en/latest/api/dgram/
var udp = require("dgram");
const mqtt = require("mqtt");
var moment = require("moment");
const config = require("../Config13319/config.json");
const common = require("@bgroves/common");
const { exit } = require("process");
const { start } = require("repl");
const util = require("./ProcessToolCounters");

var { MQTT_SERVER, UDP_PORT } = process.env;
// const MQTT_SERVER = 'localhost';
// const UDP_PORT = 2222;
var nextLine = 1;
// --------------------creating a udp server --------------------


async function main() {
  const mqttClient = mqtt.connect(`mqtt://${MQTT_SERVER}`);

  // creating a udp server
  var server = udp.createSocket("udp4");

  // emits when any error occurs
  server.on("error", function (error) {
    console.log("Error: " + error);
    server.close();
  });

  // emits on new datagram msg
  server.on("message", function (msg, info) {
    try {
      console.log("Data received from client : " + msg.toString());
      console.log(`Data received in hex =>${msg.toString("hex")}`);
      console.log("Received %d bytes", msg.length);
      // We recieve DC2,%,DC4 in datagrams by themself but receive all the common variable in one datagram.
      if (msg.length < 3) {
        console.log(`Abort: msg.length<3`);
        return;
      }

      const transDate = moment(new Date()).format("YYYY-MM-DD HH:mm:ss");
      console.log(`ToolChange transDate=>${transDate}`);

      // We receive up to 10 fixed length records in one datagram.  If we have more than 10 fixed length units
      // that are being sent then we will receive them in multiple datagrams.
      let startChar = 0;
      if (0x12 == msg[0]) {
        console.log(`Increment startChar: 0x12==msg[0]`);
        startChar++; // sometimes DC2 will arrive with line #1 and sometimes it is in a datagram by itself.
      }  // If there are multiple datagrams sent with 1 write only the
      // 1st one will have DC2.  If there is more than one write() in the
      // GCode because we are transferring more than 160 characters.  There
      // may be another DC2 character on subsequent datagrams.  This has
      // not been tested.

      // I am only recieving 7 of the first 10 bytes being sent on
      // the second datagram; maybe this is because of the 3 control
      // characters being sent: DC2,DC4, and %.  We only need 6
      // characters in the first 10 byte block so this should be ok,
      // but I need to include a character such as a comma since
      // the length is not fixed and there are 2 pieces of information is
      // being included in this 10 byte block. 
      let comma = msg.indexOf(",", startChar);
      var sCNC = msg.slice(startChar, comma).toString().trim();
      var nCNC = Number(sCNC); // returns NaN
      if (Number.isNaN(nCNC)) {
        throw new Error("Abort: sCNC isNAN");
      } else {
        console.log(`CNC = ${sCNC}`);
      }

      var datagram = comma + 1;
      var sDatagram = msg.slice(datagram, datagram+2).toString().trim(); 
      // Each datagram from Moxa should contain 10, 10 byte blocks.
      var nDatagram = Number(sDatagram); // returns NaN
      if (Number.isNaN(nDatagram)) {
        throw new Error("Abort: sDatagram isNAN");
      } else {
        console.log(`Datagram #: ${sDatagram}`);
      }

      var originalProcessID = datagram + 2;
      var sOriginalProcessID = msg.slice(originalProcessID, originalProcessID + 10).toString().trim();
      var nOriginalProcessID = Number(sOriginalProcessID); // returns NaN
      if (Number.isNaN(nOriginalProcessID)) {
        throw new Error("Abort: OriginalProcessID isNAN");
      } else {
        console.log(`OriginalProcessID=${sOriginalProcessID}`);
        // 
      }

      var startToolCounters = originalProcessID + 10;  // Priming read
      // let nOriginalProcessID = 49396; // Replace this line with the code above.
      // The part counter is always in the 1st 10 byte block after the
      // OriginalProcessID in datagram #1. 
      if(nDatagram===1) 
      {
        startToolCounters += 10;
        // TODO: Change this line to originalProcessID + 10 after adding code above
        var partCounter = originalProcessID + 10;
        var sPartCounter = msg.slice(partCounter, partCounter + 10).toString().trim();
        var nPartCounter = Number(sPartCounter); // returns NaN
        if (Number.isNaN(nPartCounter)) {
          throw new Error("Abort: PartCounter isNAN");
        } else {
          console.log(`PartCounter=${sPartCounter}`);
          //
        }
        //  looks through each element and stops at first match.
        // Make sure first match is the part counter node.
        let iNode = config.nodes.findIndex((el) => el.cnc === sCNC); 
        console.log(`sCNC=${sCNC},iNode = ${iNode}`)
        // Only publish if value has changed.
        if(nPartCounter!==config.nodes[iNode].value)
        {
          // ALERT: This code may not scale weill.
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
          console.log(`Kep13319 publish => ${kepMsgString}`);
          mqttClient.publish("Kep13319", kepMsgString);
          config.nodes[iNode].value=nPartCounter;
        }
      }

      // Returns an index of the 1st tool for this CNC/OriginalProcessID combination
      let iToolList = config.ToolList.findIndex((el) => {
        if (
          el.CNC === nCNC &&
          el.OriginalProcessID === nOriginalProcessID
        ) {
          return true;
        } else {
          return false;
        }
      });
      var propName = nDatagram;
      var dg = "dg" + propName.toString();
      console.log(`dg=${dg}`);
      var toolTrackerDatagram=config.ToolList[iToolList].ToolTracker[dg];
      console.log(toolTrackerDatagram[0].OpDescription);
      var msgToolCounters = msg.slice(startToolCounters,msg.length);
      util.ProcessToolCounters(mqttClient,toolTrackerDatagram,msgToolCounters);
    } catch (e) {
      console.log(`caught exception! ${e}`);
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
    console.log(`UDP Server is listening`);
  });

  //emits after the socket is closed using socket.close();
  server.on("close", function () {
    console.log("Socket is closed !");
  });
  server.bind(UDP_PORT);
}

main();
