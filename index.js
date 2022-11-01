import fetch from "node-fetch";
import nacl from "tweetnacl";
import util from "tweetnacl-util";
import fs from "fs";
import rl from "readline";

const ANCHORAGE_BASE_URL = "https://api.anchorage.com";
const PLACEHOLDER_API_KEY = "REPLACE_WITH_API_KEY";
const TRANSACTION_CHECK_INTERVAL = 30000;

let keyFile;

try {
  keyFile = fs.readFileSync("keys.json");
} catch (e) {
  console.log("Please run node ./generateKeys.js before running this file");
  throw e;
}

const keyObj = JSON.parse(keyFile);

if (!keyObj.anchorageApiKey || keyObj.anchorageApiKey === PLACEHOLDER_API_KEY) {
  throw "Please generate an anchorage API key as per instructions and add it to keys.json";
}

const anchorageApiKey = keyObj.anchorageApiKey;
const secretKeyHex = keyObj.secretKeyHex;

const hexStringToByteArray = (hexString) => {
  if (hexString.length % 2 !== 0) {
    throw "Must have an even number of hex digits to convert to bytes";
  }
  var numBytes = hexString.length / 2;
  var byteArray = new Uint8Array(numBytes);
  for (var i = 0; i < numBytes; i++) {
    byteArray[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return byteArray;
};

const transactions = [];

// read data in from a .csv
const reader = rl.createInterface({
  input: fs.createReadStream("withdrawals.csv"),
});

reader.on("line", (row) => {
  transactions.push(row.split(","));
});

reader.on("close", () => {
  processTransactions();
});

console.log("Starting to process transactions...");

// create withdrawal from first entry
// wait for that entry to move to complete or fail
// go to next entry
const checkTransactionStatus = async (transactionId) => {
  const path = "/v2/transactions/" + transactionId;
  const response = await fetch(`${ANCHORAGE_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Api-Access-Key": anchorageApiKey,
    },
  }).catch((error) => {
    console.log("transactions-response-error: ", error);
  });
  
  const result = await response.json().catch((error) => {
    console.log("transactions-result-error: ", error);
  });
  
  if (!result) {
    console.log("error with result");
  } else if (result.errorType) {
    console.log("error: ", result.message);
  } else {
    console.log(`The status of transaction ${transactionId}: ${result.data.status}`);
    console.log("Waiting 30s then checking transaction status again...");

    // Set timeout doesn't return a promise, we need to wrap it in one
    await new Promise((resolve) => {
      setTimeout(resolve(), TRANSACTION_CHECK_INTERVAL);
    });

    await checkTransactionStatus(transactionId);
  }
};

// puts together info for a withdrawal and sends
const createWithdrawal = async (transaction) => {
  var sendingVaultId = transaction[0];
  var assetType = transaction[1];
  var destination = transaction[2];
  var amount = transaction[3];
  var destinationType = transaction[4];
  var institutionName = transaction[5];
  var institutionCountry = transaction[6];
  var recipientType = transaction[7];
  var recipientName = transaction[8];
  var recipientCountry = transaction[9];

  return await send(
    sendingVaultId,
    assetType,
    destination,
    amount,
    destinationType,
    institutionName,
    institutionCountry,
    recipientType,
    recipientName,
    recipientCountry
  );
};

const processTransactions = async () => {
  for (const transaction of transactions) {
    const newTransactionId = await createWithdrawal(transaction);

    if (!newTransactionId) {
      throw "Error creating new transaction";
    }

    await checkTransactionStatus(newTransactionId);
  }
};

// sends withdrawal to Anchorage API
const send = async (
  sendingVaultId,
  assetType,
  destination,
  amount,
  destinationType,
  institutionName,
  institutionCountry,
  recipientType,
  recipientName,
  recipientCountry
) => {
  const secretKey = hexStringToByteArray(secretKeyHex);
  const timestamp = Math.ceil(new Date().getTime() / 1000).toString();
  const method = "POST";
  const path = "/v2/transactions/withdrawal";
  const requestData = {
    sendingVaultId: sendingVaultId,
    amount: amount,
    assetType: assetType,
    destinationAddress: destination,
    amlQuestionnaire: {
      destinationType: destinationType,
      institutionName: institutionName,
      institutionCountry: institutionCountry,
      recipientType: recipientType,
      recipientName: recipientName,
      recipientCountry: recipientCountry,
    },
  };
  const requestBody = JSON.stringify(requestData);
  const msgStr = `${timestamp}${method}${path}${requestBody}`;
  const msgDecoded = util.decodeUTF8(msgStr);
  const signature = nacl.sign.detached(msgDecoded, secretKey);
  const signatureHex = Buffer.from(signature, "base64").toString("hex");
  const response = await fetch(`${ANCHORAGE_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Api-Access-Key": anchorageApiKey,
      "Api-Signature": signatureHex,
      "Api-Timestamp": timestamp,
    },
    body: requestBody,
  });

  const result = await response.json();
  
  if (!result.errorType) {
    transactionId = await result.data.withdrawalId;
    console.log(`New transaction ${transactionId} created!`);
    return transactionId;
  } else {
    console.log(
      "error: There was an error creating this transaction, check that no transactions are currently processing for this vault"
    );
  }
};
