import fetch from "node-fetch";
import nacl from "tweetnacl";
import util from "tweetnacl-util";
import fs from "fs";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

import hexStringToByteArray from "./utils/hexStringToByteArray.js";
import validateCsv from "./utils/validateCsv.js";

// const ANCHORAGE_BASE_URL = "https://api.anchorage-development.com";
const ANCHORAGE_BASE_URL = "https://api.anchorage.com";
const PLACEHOLDER_API_KEY = "REPLACE_WITH_API_KEY";
const SUCCESS_TRANSACTIONS_HEADERS = [
  "sendingVaultId",
  "assetType",
  "destinationAddress",
  "amount",
  "destinationType",
  "institutionName",
  "institutionCountry",
  "recipientType",
  "recipientName",
  "recipientCountry",
];

const FAILED_TRANSACTIONS_HEADERS = [
  "sendingVaultId",
  "assetType",
  "destinationAddress",
  "amount",
  "destinationType",
  "institutionName",
  "institutionCountry",
  "recipientType",
  "recipientName",
  "recipientCountry",
  "errorType",
  "errorMessage",
];

const TRANSACTION_CHECK_INTERVAL = 30000;
let withdrawalFailed = false;

let keyFile;

const recheckTransaction = async (transactionId, transactionDetails, anchorageApiKey) => {
  console.log("Waiting 30s then checking transaction status again...");
  // Set timeout doesn't return a promise, we need to wrap it in one
  await new Promise((resolve) => {
    setTimeout(resolve, TRANSACTION_CHECK_INTERVAL);
  });

  return await checkTransactionStatus(transactionId, transactionDetails, anchorageApiKey);
};

// create withdrawal from first entry
// wait for that entry to move to complete or fail
// go to next entry
const checkTransactionStatus = async (transactionId, transactionDetails, anchorageApiKey) => {
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
    await recheckTransaction(transactionId, transactionDetails, anchorageApiKey);    
  } else if (result.errorType) {
    console.log("error: ", result.message);
  } else {
    console.log(`The status of transaction ${transactionId}: ${result.data.status}`);

    if (
      result.data.status !== "INPROGRESS" &&
      result.data.status !== "NEEDS_APPROVAL"
    ) {
      if (result.data.status === "FAILURE") {
        withdrawalFailed = true;

        const failedWithdrawalStr = stringify([
          {
            ...transactionDetails,
            errorType: "Failure",
            errorMessage: "The transaction has failed",
          },
        ]);

        fs.appendFileSync("failedWithdrawals.csv", `\n${failedWithdrawalStr}`);
      } else if (result.data.status === "REJECTED") {
        withdrawalFailed = true;

        const failedWithdrawalStr = stringify([
          {
            ...transactionDetails,
            errorType: "Rejeceted",
            errorMessage: "The transaction was rejected",
          },
        ]);

        fs.appendFileSync("failedWithdrawals.csv", `\n${failedWithdrawalStr}`);
      } else if (result.data.status === "SUCCESS") {
        const successfulWithdrawalStr = stringify([transactionDetails]);

        fs.appendFileSync("successfulWithdrawals.csv", `\n${successfulWithdrawalStr}`);
      }

      return;
    }

    return await recheckTransaction(transactionId, transactionDetails, anchorageApiKey);
  }
};

// sends withdrawal to Anchorage API
const send = async (transactionParams, anchorageApiKey, secretKeyHex) => {
  const secretKey = hexStringToByteArray(secretKeyHex);
  const timestamp = Math.ceil(new Date().getTime() / 1000).toString();
  const method = "POST";
  const path = "/v2/transactions/withdrawal";
  const {
    sendingVaultId,
    assetType,
    destinationAddress,
    amount,
    destinationType,
    institutionName,
    institutionCountry,
    recipientType,
    recipientName,
    recipientCountry,
  } = transactionParams;

  const requestData = {
    sendingVaultId,
    amount,
    assetType,
    destinationAddress,
    amlQuestionnaire: {
      destinationType,
      institutionName,
      institutionCountry,
      recipientType,
      recipientName,
      recipientCountry,
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
    const transactionId = await result.data.withdrawalId;
    console.log(`New transaction ${transactionId} created!`);
    return transactionId;
  } else {
    withdrawalFailed = true;

    const failedWithdrawalStr = stringify([{
      ...transactionParams,
      errorType: result.errorType,
      errorMessage: result.message,
    }]);

    fs.appendFileSync("failedWithdrawals.csv", `\n${failedWithdrawalStr}`);
  }
};

const processTransactions = async (
  transactions,
  anchorageApiKey,
  secretKeyHex
) => {
  for (const transaction of transactions) {
    const newTransactionId = await send(
      transaction,
      anchorageApiKey,
      secretKeyHex
    );
    
    if (newTransactionId) {
      await checkTransactionStatus(newTransactionId, transaction, anchorageApiKey);
    }
  }
};

const main = async () => {
  try {
    keyFile = fs.readFileSync("keys.json");
  } catch (e) {
    console.log("Please run node ./generateKeys.js before running this file");
    return;
  }

  const keyObj = JSON.parse(keyFile);

  if (!keyObj.anchorageApiKey || keyObj.anchorageApiKey === PLACEHOLDER_API_KEY) {
    console.log("Please generate an anchorage API key as per instructions and add it to keys.json");
    return;
  }

  const { anchorageApiKey, secretKeyHex } = keyObj;

  console.log("Starting to process transactions...");

  try {
    const transactions = parse(fs.readFileSync("withdrawals.csv"), {
      columns: true,
    });

    validateCsv(transactions);

    fs.writeFileSync("successfulWithdrawals.csv", SUCCESS_TRANSACTIONS_HEADERS.join(','));
    fs.writeFileSync(
      "failedWithdrawals.csv",
      FAILED_TRANSACTIONS_HEADERS.join(",")
    );

    await processTransactions(transactions, anchorageApiKey, secretKeyHex);

    const previousWithdrawalsStr = stringify(transactions, {
      header: true,
    });

    fs.writeFileSync("previousWithdrawals.csv", previousWithdrawalsStr);

    fs.writeFileSync("withdrawals.csv", "");

    if (withdrawalFailed) {
      console.log(
        "Some transactions failed, please check failedWithdrawals.csv for a list of failed transactions and their errors"
      );
    } else {
      console.log("All transactions were successfully executed!");
    }    
  } catch (e) {
    console.log(
      "There was an issue running the application, please check the error below"
    );
    console.log(e);
  }
};

// Kick it off
main();