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

      /*
      COM DATA FORMAT: DC2 - AT MOST 160 BYTES OF DATA - '%' - DC4.
      UDP DATAGRAM FORMAT: 
      1ST POSSIBILITY
      DC2 + 10 10-BYTE BLOCKS
      '%' ALONE THEN DC4 ALONE, OR '%' + DC4 TOGETHER
      2ND POSSIBILITY
      DC2 ALONE
      10 10-BYTE BLOCKS
      '%' ALONE THEN DC4 ALONE, OR '%' + DC4 TOGETHER
      */

      // I am only recieving 7 of the first 10 bytes being sent on
      // the second datagram; maybe this is because of the 3 control
      // characters being sent: DC2,DC4, and %.  
      // Since the first 10-byte block is the header we can 
      // include a character such as a comma to parse it instead
      // of relying on a fixed 10 byte format to retrieve the 
      // 3 peices of information it contains.
      
      let comma = msg.indexOf(",", startChar);
      var sCNC = msg.slice(startChar, comma).toString().trim();
      var nCNC = Number(sCNC); // returns NaN
      if (Number.isNaN(nCNC)) {
        throw new Error("Abort: sCNC isNAN");
      } else {
        console.log(`CNC = ${sCNC}`);
      }

      var datagramId = comma + 1;
      var sDatagramId = msg.slice(datagramId, datagramId+2).toString().trim(); 
      // Each datagram from Moxa should contain 10, 10 byte blocks.
      var nDatagramId = Number(sDatagramId); // returns NaN
      if (Number.isNaN(nDatagramId)) {
        throw new Error("Abort: sDatagramId isNAN");
      } else {
        console.log(`Datagram Id#: ${sDatagramId}`);
      }

      var toolListKey = datagramId + 2;
      var sToolListKey = msg.slice(toolListKey, toolListKey + 10).toString().trim();
      var nToolListKey = Number(sToolListKey); // returns NaN
      if (Number.isNaN(nToolListKey)) {
        throw new Error("Abort: ToolListKey isNAN");
      } else {
        console.log(`ToolListKey=${sToolListKey}`);
        // 
      }

      var startToolCounters = toolListKey + 10;  // Priming read
 
      // Returns an index of the 1st tool for this CNC/ToolListKey combination
      let iToolList = config.ToolList.findIndex((el) => {
        if (
          el.CNC === nCNC &&
          el.ToolListKey === nToolListKey
        ) {
          return true;
        } else {
          return false;
        }
      });
      var dg = "dg" + sDatagramId.toString();
      console.log(`dg=${dg}`);
      var Datagram=config.ToolList[iToolList].Datagram[dg];
      console.log(Datagram[0].OpDescription);
      var msgToolCounters = msg.slice(startToolCounters,msg.length);
      util.ProcessToolCounters(mqttClient,transDate,nCNC,Datagram,msgToolCounters);
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
