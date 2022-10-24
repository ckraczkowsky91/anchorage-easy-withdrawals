import fetch from 'node-fetch';
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
import fs from 'fs';
import rl from 'readline';
// import generateKeys from './utils/generateKeys.js';

const ANCHORAGE_BASE_URL = 'https://api.anchorage.com';
const ANCHORAGE_API_KEY = '';
const secretKeyHex = '';

const hexStringToByteArray = (hexString) => {
    if (hexString.length % 2 !== 0) {
        throw "Must have an even number of hex digits to convert to bytes";
    }
    var numBytes = hexString.length / 2;
    var byteArray = new Uint8Array(numBytes);
    for (var i=0; i<numBytes; i++) {
        byteArray[i] = parseInt(hexString.substr(i*2, 2), 16);
    }
    return byteArray;
};

var arr = [];
var transactionProcessing = false;
var transactionId = 'x';
var arrayCounter = 1;

// read data in from a .csv
const reader = rl.createInterface({
    input: fs.createReadStream('withdrawals.csv')
  });
  reader.on("line", (row) => {
    arr.push(row.split(","));
  });
  reader.on("close", () => {
    processTransactions();
});

console.log('Starting to process transactions...')

// create withdrawal from first entry
// wait for that entry to move to complete or fail
// go to next entry

const checkTransactionStatus = async () => {
  const method = 'GET';
  const path = '/v2/transactions/' + transactionId;
  const response = await fetch(`${ANCHORAGE_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Api-Access-Key': ANCHORAGE_API_KEY
    }
  })
    .catch((error) => {
      console.log('transactions-response-error: ', error);
    })
  // console.log("erroring-response", response);
  var result =  await response.json()
    .catch((error) => {
      console.log('transactions-result-error: ', error);
    })
  // console.log('stats-result', result);
  if (!result) {
    console.log('error with result');
    transactionProcessing = true;
  }
  else if (result.errorType) {
    console.log('error: ', result.message);
    transactionProcessing = false;
  } else if (result.data.status == 'SUCCESS' || result.data.status == 'FAILURE' || result.data.status == 'REJECTED'){
    // console.log(result.data.status);
    // console.log('inside else if');
    transactionProcessing = false;
  } else {
    // console.log(result.data.status);
    // console.log('inside else');
    console.log('The status of transaction ' + transactionId + ' is: ' + result.data.status);
    transactionProcessing = true;
    console.log('Checking transactions...')
  }
};

// puts together info for a withdrawal and sends
const createWithdrawal = async () => {
    var sendingVaultId = arr[arrayCounter][0];
    var assetType = arr[arrayCounter][1];
    var destination = arr[arrayCounter][2];
    var amount = arr[arrayCounter][3];
    var destinationType = arr[arrayCounter][4];
    var institutionName = arr[arrayCounter][5];
    var institutionCountry = arr[arrayCounter][6];
    var recipientType = arr[arrayCounter][7];
    var recipientName = arr[arrayCounter][8];
    var recipientCountry = arr[arrayCounter][9];
    await send(sendingVaultId, assetType, destination, amount, destinationType, institutionName, institutionCountry, recipientType, recipientName, recipientCountry);
    arrayCounter++;
};

const processTransactions = async() => {
  await checkTransactionStatus();
  if(arrayCounter == arr.length){
    console.log('All transactions submitted!');
  } else if (transactionProcessing == false){
      await createWithdrawal();
      processTransactions();
  } else {
    setTimeout(processTransactions, 30000);
  }
};

// sends withdrawal to Anchorage API
const send = async (sendingVaultId, assetType, destination, amount, destinationType, institutionName, institutionCountry, recipientType, recipientName, recipientCountry) =>{
    const secretKey = hexStringToByteArray(secretKeyHex);
    const timestamp = Math.ceil(new Date().getTime() / 1000).toString();
    const method = 'POST';
    const path = '/v2/transactions/withdrawal';
    const requestData = {
      sendingVaultId: sendingVaultId,
      amount: amount,
      assetType: assetType,
      destinationAddress: destination,
      amlQuestionnaire: {
        "destinationType": destinationType,
        "institutionName": institutionName,
        "institutionCountry": institutionCountry,
        "recipientType": recipientType,
        "recipientName": recipientName,
        "recipientCountry": recipientCountry
      }
    };
    const requestBody = JSON.stringify(requestData);
    const msgStr = `${timestamp}${method}${path}${requestBody}`;
    const msgDecoded = util.decodeUTF8(msgStr);
    const signature = nacl.sign.detached(msgDecoded, secretKey);
    const signatureHex = Buffer.from(signature, 'base64').toString('hex');
    const response = await fetch(`${ANCHORAGE_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Api-Access-Key': ANCHORAGE_API_KEY,
        'Api-Signature': signatureHex,
        'Api-Timestamp': timestamp,
      },
      body: requestBody,
    })
    var result =  await response.json()
    // console.log( `result-> ${JSON.stringify(result)}`);
    if (!result.errorType){
      transactionId = await result.data.withdrawalId;
      console.log('New transaction ' + transactionId + ' created!');
    } else {
      console.log('error: There was an error creating this transaction, check that no transactions are currently processing for this vault')
    }
};
