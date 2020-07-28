// https://node.readthedocs.io/en/latest/api/dgram/
var udp = require("dgram");
const mqtt = require('mqtt');
var moment = require("moment");
// const config = require("../Config13319/config.json");
const common = require("@bgroves/common");
const { exit } = require("process");
const { start } = require("repl");

// var { MQTT_SERVER, UDP_PORT } = process.env;
const MQTT_SERVER = 'localhost';
const UDP_PORT = 2222;
var nextLine = 1;
// --------------------creating a udp server --------------------

async function main() {
//  const mqttClient = mqtt.connect(`mqtt://${MQTT_SERVER}`);

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
      console.log("1Data received from client : " + msg.toString());
      console.log(`Data received in hex =>${msg.toString("hex")}`);
      console.log(
        "Received %d bytes from %s:%d\n",
        msg.length
      );
      if(msg.length<3){
        console.log(`msg.length<3`);
        return;
      }
      if(nextLine==1)
      { 

        nextLine = 2;
        let startChar = 0;
        if(0x12==msg[0])
        {
          console.log(`0x12==msg[0]`);
          startChar++;
  
        } 
        var cnc = msg.slice(startChar, startChar+10);
        var strCNC = cnc.toString();
        var numCNC = Number(strCNC); // returns NaN
        if (Number.isNaN(numCNC)) {
          throw new Error("strCNC isNAN");
        } else {
          console.log(`strCNC ${strCNC} IS a number`);
        }
        var partCounter = startChar+10;
        var sPartCounter = msg.slice(partCounter, partCounter+10);
        var nPartCounter = Number(sPartCounter); // returns NaN
        if (Number.isNaN(nPartCounter)) {
          throw new Error("Tool1 isNAN");
        } else {
          console.log(`PartCounter.start=${partCounter},end=${partCounter+10} = ${sPartCounter}`);
        }
        var tool1 = partCounter+10;
        var sTool1 = msg.slice(tool1, tool1+10);
        var nTool1 = Number(sTool1); // returns NaN
        if (Number.isNaN(nTool1)) {
          throw new Error("Tool1 isNAN");
        } else {
          console.log(`Tool1.start=${tool1},end=${tool1+10} = ${sTool1}`);
        }
        var tool2 = tool1+10;
        var sTool2 = msg.slice(tool2, tool2+10);
        var nTool2 = Number(sTool2); // returns NaN
        if (Number.isNaN(nTool2)) {
          throw new Error("Tool2 isNAN");
        } else {
          console.log(`Tool2 ${sTool2} IS a number`);
        }
        var tool3 = tool2+10;
        var sTool3 = msg.slice(tool3, tool3+10);
        var nTool3 = Number(sTool3); // returns NaN
        if (Number.isNaN(nTool3)) {
          throw new Error("Tool3 isNAN");
        } else {
          console.log(`Tool3 ${sTool3} IS a number`);
        }
        var tool4 = tool3+10;
        var sTool4 = msg.slice(tool4, tool4+10);
        var nTool4 = Number(sTool4); // returns NaN
        if (Number.isNaN(nTool4)) {
          throw new Error("Tool4 isNAN");
        } else {
          console.log(`Tool4 ${sTool4} IS a number`);
        }
        var tool5 = tool4+10;
        var sTool5 = msg.slice(tool5, tool5+10);
        var nTool5 = Number(sTool5); // returns NaN
        if (Number.isNaN(nTool5)) {
          throw new Error("Tool5 isNAN");
        } else {
          console.log(`Tool5 ${sTool5} IS a number`);
        }
        var tool6 = tool5+10;
        var sTool6 = msg.slice(tool6, tool6+10);
        var nTool6 = Number(sTool6); // returns NaN
        if (Number.isNaN(nTool6)) {
          throw new Error("Tool6 isNAN");
        } else {
          console.log(`Tool6 ${sTool6} IS a number`);
        }
        var tool7 = tool6+10;
        var sTool7 = msg.slice(tool7, tool7+10);
        var nTool7 = Number(sTool7); // returns NaN
        if (Number.isNaN(nTool7)) {
          throw new Error("Tool7 isNAN");
        } else {
          console.log(`Tool7 ${sTool7} IS a number`);
        }
        var tool8 = tool7+10;
        var sTool8 = msg.slice(tool8, tool8+10);
        var nTool8 = Number(sTool8); // returns NaN
        if (Number.isNaN(nTool8)) {
          throw new Error("Tool8 isNAN");
        } else {
          console.log(`Tool8 ${sTool8} IS a number`);
        }
        line = 2;
      }
      else
      {
        nextLine = 1;
        let startCharLine2 = msg.indexOf(":", 0);
        startCharLine2=startCharLine2+1;
  
        var tool9 = startCharLine2;
        var sTool9 = msg.slice(tool9, tool9+10);
        var nTool9 = Number(sTool9); // returns NaN
        if (Number.isNaN(nTool9)) {
          throw new Error("Tool9 isNAN");
        } else {
          console.log(`Tool9 ${sTool9} IS a number`);
        }
        var tool10 = tool9+10;
        var sTool10 = msg.slice(tool10, tool10+10);
        var nTool10 = Number(sTool10); // returns NaN
        if (Number.isNaN(nTool10)) {
          throw new Error("Tool10 isNAN");
        } else {
          console.log(`Tool10 ${sTool10} IS a number`);
        }
        var tool11 = tool10+10;
        var sTool11 = msg.slice(tool11, tool11+10);
        var nTool11 = Number(sTool11); // returns NaN
        if (Number.isNaN(nTool11)) {
          throw new Error("Tool11 isNAN");
        } else {
          console.log(`Tool11 ${sTool11} IS a number`);
        }
        var tool12 = tool11+10;
        var sTool12 = msg.slice(tool12, tool12+10);
        var nTool12 = Number(sTool12); // returns NaN
        if (Number.isNaN(nTool12)) {
          throw new Error("Tool12 isNAN");
        } else {
          console.log(`Tool12 ${sTool12} IS a number`);
        }

      }    


/*
      var sTool3 = msg.slice(31, 40);
      console.log(`Tool2= ${sTool3}`);
      var nTool3 = Number(sTool3); // returns NaN
      if (Number.isNaN(nTool3)) {
        throw new Error("Tool3 isNAN");
      } else {
        console.log(`Tool3 IS a number`);
      }
*/

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
  });

  //emits after the socket is closed using socket.close();
  server.on("close", function () {
    common.log("Socket is closed !");
  });
  server.bind(UDP_PORT);
}

main();
