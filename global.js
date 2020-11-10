const mariadb = require("mariadb");
const common = require("@bgroves/common");

const {
    MYSQL_HOSTNAME,
    MYSQL_PORT,
    MYSQL_USERNAME,
    MYSQL_PASSWORD,
    MYSQL_DATABASE,
  } = process.env;
  

/*
const MQTT_SERVER='localhost';
const MQTT_PORT='1882';
const MYSQL_HOSTNAME= "localhost";
const MYSQL_PORT='3305';
const MYSQL_USERNAME= "brent";
const MYSQL_PASSWORD= "JesusLives1!";
const MYSQL_DATABASE= "Plex";
const  START_MACHINING = 50;
const  END_MACHINING = 51;

*/
const connectionString = {
  connectionLimit: 5,
  multipleStatements: true,
  host: MYSQL_HOSTNAME,
  port: MYSQL_PORT,
  user: MYSQL_USERNAME,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
};

common.log(
  `user: ${MYSQL_USERNAME},password: ${MYSQL_PASSWORD}, database: ${MYSQL_DATABASE}, MYSQL_HOSTNAME: ${MYSQL_HOSTNAME}, MYSQL_PORT: ${MYSQL_PORT}`
);

const pool = mariadb.createPool(connectionString);

module.exports={
 ToolAssembly,
 pool
}