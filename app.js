// https://node.readthedocs.io/en/latest/api/dgram/
var udp = require("dgram");
var moment = require('moment');
// const config = require("../Config13319/config.json");
const common = require("@bgroves/common");

var { MQTT_SERVER, UDP_PORT } = process.env;
common.log(`MQTT_SERVER=${MQTT_SERVER}`);
common.log(`UDP_PORT=${UDP_PORT}`);
// --------------------creating a udp server --------------------

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
      common.log(`Data received in ascii =>${msg.toString("ascii")}`);
      common.log(
        "Received %d bytes from %s:%d\n",
        msg.length,
        info.address,
        info.port
      );

  /*
  buffer.indexOf(value, start, encoding);
  */
      let startChar = msg.indexOf("}", 0);
      common.log(`msg.indexOf('}', 0)=>${startChar}`);
      if (startChar === -1) {
        throw new Error("No startChar in message");
      }

      let firstComma = msg.indexOf(",", startChar);
      if (firstComma === -1) {
        throw new Error("No comma in message");
      }

      common.log(`msg.indexOf(',', startChar)=>${firstComma}`);
      var id = msg.slice(startChar + 1, firstComma);
      common.log(`CNC id=>${id}`);
      var strId = id.toString();
      var numId = Number(strId); // returns NaN
      if (Number.isNaN(numId)) {
        common.log(`strId is NOT a number`);
        throw new Error("strId isNAN");
      } else {
        common.log(`strId IS a number`);
      }

      let endOfFrame = msg.indexOf('%',firstComma);
      common.log(`1. endOfFrame=>${endOfFrame}`);
      if(-1===endOfFrame){
        endOfFrame = msg.length;
        common.log(`2. endOfFrame=>${endOfFrame}`);
      }
      
      var bufPartCounter = msg.slice(firstComma + 1, endOfFrame);
      common.log(`bufPartCounter=>${bufPartCounter}`);
      var strPartCounter = bufPartCounter.toString().trim();
      var numPartCounter = Number(strPartCounter); // returns NaN

      if (Number.isNaN(numPartCounter)) {
        throw new Error(`partCounter is NOT a number =>${strPartCounter}`);
      } else {
        common.log(`partCounter IS a number=>${strPartCounter}`);
      }
      const transDate = moment(new Date()).format("YYYY-MM-DDTHH:mm:ss");
      common.log(`transDate=>${transDate}`);

      let value = parseInt(dataValue.value.value.toString());
      let msg = {
        updateId: config.nodes[i].updateId,
        nodeId: config.nodes[i].nodeId,
        name: config.nodes[i].name,
        plexus_Customer_No: config.nodes[i].plexus_Customer_No,
        pcn: config.nodes[i].pcn,
        workcenter_Key: config.nodes[i].workcenter_Key,
        workcenter_Code: config.nodes[i].workcenter_Code,
        cnc: config.nodes[i].cnc,
        value: value,
        transDate: transDate
      };

      let msgString = JSON.stringify(msg);
      common.log(`Kep13319 publish => ${msgString}`);
      mqttClient.publish('Kep13319', msgString);

    } catch (e) {
      common.log(`caught exception! ${e}`);
    } finally {
      common.log("Data sent !!!");
    }
  });

  //emits when socket is ready and listening for datagram msgs
  server.on("listening", function () {
    var address = server.address();
    var port = address.port;
    var family = address.family;
    var ipaddr = address.address;
    common.log("Server is listening at port" + port);
    common.log("Server ip :" + ipaddr);
    common.log("Server is IP4/IP6 : " + family);
  });

  //emits after the socket is closed using socket.close();
  server.on("close", function () {
    common.log("Socket is closed !");
  });

  server.bind(UDP_PORT);
}

main();

