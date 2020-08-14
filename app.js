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
      // will be another DC2 character on subsequent datagrams.  

      /*
      COM DATA FORMAT: DC2 - AT MOST 160 BYTES OF DATA - '%' - DC4.
      UDP DATAGRAM MESSAGE FORMAT: 
      1ST Message options:
      1. DC2 ALONE
      2. DC2 + 10 10-BYTE BLOCKS
      2nd Message options:
      1. 10 10-BYTE BLOCKS + %
      2. 10 10-BYTE BLOCKS
      3rd Message options:
      1. '%' ALONE 
      2. DC4 ALONE
      3. '%' + DC4 TOGETHER
      4th Message options:
      1. DC4 ALONE
      2. NOTHING
      */

      // I am only recieving 7 of the first 10 bytes being sent on
      // the second datagram message; maybe this is because of the 3 control
      // characters being sent: DC2,DC4, and %.  
      // Since the first 10-byte block is a header that contains the 
      // datagram number and it will only be 2 bytes long so we can preceed 
      // it with a comma to determine its starting position since we can not
      // rely on recieving all 10 bytes of the 1st 10-byte block sent.
      
      let comma = msg.indexOf(",", startChar);
      var sDatagramId = msg.slice(comma+1, comma+2).toString().trim();
      var nDatagramId = Number(sDatagramId); // returns NaN
      if (Number.isNaN(nDatagramId)) {
        throw new Error("Abort: sDatagramId isNAN");
      } else {
        console.log(`Datagram Id#: ${sDatagramId}`);
      }

      // All of the remaining data sent is contained in a fixed length 10-byte format
      let CNC_Key = comma+2;
      var sCNC_key = msg.slice(CNC_Key, CNC_Key + 10).toString().trim();
      var nCNC_Key = Number(sCNC_key); // returns NaN
      if (Number.isNaN(nCNC_Key)) {
        throw new Error("Abort: sCNC_Key isNAN");
      } else {
        console.log(`CNC_Key = ${sCNC_key}`);
      }

      let Part_Key = CNC_Key + 10;
      var sPart_key = msg.slice(Part_Key, Part_Key + 10).toString().trim();
      var nPart_Key = Number(sPart_key); // returns NaN
      if (Number.isNaN(nPart_Key)) {
        throw new Error("Abort: sPart_Key isNAN");
      } else {
        console.log(`Part_Key = ${sPart_key}`);
      }

      var startToolCounters = Part_Key + 10;  // Priming read
 
      // Returns an index of the 1st tool for this CNC/ToolListKey combination
      let iPart = config.Part.findIndex((el) => {
        if (el.Part_Key === nPart_Key) {
          return true;
        } else {
          return false;
        }
      });
      if (-1===iPart)
      {
        throw new Error(`Abort: Can't find Part_Key: ${nPart_Key},config.Part=${config.Part}`);
      }
      var oPart=config.Part[iPart];
      console.log(`Part_Key = ${oPart.Part_Key}`);
      var msgToolCounters = msg.slice(startToolCounters,msg.length);  // There could be a % character at end of buffer

      // Determine starting point in assembly_key array.
      var idxStart = 0;
      var idxEnd = 0;
      switch(nDatagramId) {
        case 1:
          idxStart=0;
          idxEnd=7;
          break;
        case 2:
          idxStart=7;
          idxEnd=10;
          break;
        case 3:
          idxStart=10;
          idxEnd=12;
          break;
        default:
        // code block
      }
      console.log(`idxStart: ${idxStart},idxEnd: ${idxEnd}`);


      util.ProcessToolCounters(mqttClient,transDate,nCNC_Key,nPart_Key,oPart,idxStart,idxEnd,msgToolCounters);
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
